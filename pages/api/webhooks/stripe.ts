import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseServer } from "../../../lib/supabaseServer";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const config = { api: { bodyParser: false } };

function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!stripe || !webhookSecret) return res.status(503).json({ error: "Webhook not configured" });

  const rawBody = await getRawBody(req);
  let event: Stripe.Event;
  try {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      return res.status(400).json({ error: "Missing signature" });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const paymentId = pi.metadata?.paymentId;
    if (paymentId) {
      await supabaseServer
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);
    }
  }

  return res.status(200).json({ received: true });
}
