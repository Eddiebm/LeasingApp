import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { applicationId, amountCents } = req.body ?? {};
  if (!applicationId || typeof amountCents !== "number" || amountCents < 50) {
    return res.status(400).json({ error: "applicationId and amountCents (min 50) required" });
  }

  const { data: app } = await supabaseServer
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return res.status(404).json({ error: "Application not found" });

  if (!stripe) return res.status(503).json({ error: "Payments not configured" });

  const { data: paymentRow, error: payError } = await supabaseServer
    .from("payments")
    .insert({
      application_id: applicationId,
      amount_cents: amountCents,
      status: "pending"
    })
    .select("id")
    .single();

  if (payError || !paymentRow) {
    console.error(payError);
    return res.status(500).json({ error: "Failed to create payment record" });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    metadata: { applicationId, paymentId: (paymentRow as { id: string }).id }
  });

  await supabaseServer
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", (paymentRow as { id: string }).id);

  return res.status(200).json({ clientSecret: paymentIntent.client_secret });
}
