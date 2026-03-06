import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
  if (!token) return res.status(400).json({ error: "Missing token." });

  const env = getRequestContext().env as Record<string, string>;
  const stripeKey = env.STRIPE_SECRET_KEY;

  const supabase = getSupabaseServer();
  const { data: row, error: fetchError } = await supabase
    .from("lease_download_tokens")
    .select("lease_text, form_json, stripe_session_id")
    .eq("token", token)
    .single();

  if (fetchError || !row) return res.status(404).json({ error: "Lease not found or expired." });

  const sessionId = row.stripe_session_id as string | null;
  if (!sessionId) return res.status(403).json({ error: "Payment required to download." });

  if (stripeKey) {
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return res.status(403).json({ error: "Payment not completed." });
    }
  }

  return res.status(200).json({
    leaseText: row.lease_text,
    formData: row.form_json ?? {},
  });
}
