import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const SCREENING_FEE_CENTS = Math.max(50, Math.round(Number(process.env.SCREENING_FEE_CENTS) || 3500)); // default $35

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { applicationId } = req.body ?? {};
  if (!applicationId || typeof applicationId !== "string") {
    return res.status(400).json({ error: "applicationId required" });
  }

  const { data: app } = await getSupabaseServer()
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return res.status(404).json({ error: "Application not found" });

  const { data: existing } = await getSupabaseServer()
    .from("payments")
    .select("id, status")
    .eq("application_id", applicationId)
    .eq("payment_type", "screening_fee")
    .maybeSingle();
  if (existing && existing.status === "paid") {
    return res.status(400).json({ error: "Screening fee already paid for this application" });
  }

  if (!stripe) return res.status(503).json({ error: "Payments not configured" });

  const { data: paymentRow, error: payError } = await getSupabaseServer()
    .from("payments")
    .insert({
      application_id: applicationId,
      amount_cents: SCREENING_FEE_CENTS,
      status: "pending",
      payment_type: "screening_fee"
    })
    .select("id")
    .single();

  if (payError || !paymentRow) {
    console.error(payError);
    return res.status(500).json({ error: "Failed to create payment record" });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: SCREENING_FEE_CENTS,
    currency: "usd",
    metadata: {
      applicationId,
      paymentId: (paymentRow as { id: string }).id,
      payment_type: "screening_fee"
    }
  });

  await getSupabaseServer()
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", (paymentRow as { id: string }).id);

  return res.status(200).json({
    clientSecret: paymentIntent.client_secret,
    amountCents: SCREENING_FEE_CENTS
  });
}
