import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const env = getRequestContext().env as Record<string, string>;
  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(503).json({ error: "Payments not configured." });

  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return res.status(400).json({ error: "Missing token." });

  const supabase = getSupabaseServer();
  const { data: row, error: fetchError } = await supabase
    .from("lease_download_tokens")
    .select("id, form_json")
    .eq("token", token)
    .single();

  if (fetchError || !row) return res.status(404).json({ error: "Lease not found or expired." });

  const formJson = (row.form_json ?? {}) as Record<string, unknown>;
  const country = String(formJson.country ?? "").trim();
  const isUK = country === "UK";
  const currency = isUK ? "gbp" : "usd";
  const unitAmount = isUK ? 1500 : 1800; // £15 / $18

  const origin = (req.headers.origin || req.headers.referer || "").replace(/\/$/, "") || "http://localhost:3000";
  const successUrl = `${origin}/generate-lease?paid=1&token=${encodeURIComponent(token)}`;
  const cancelUrl = `${origin}/generate-lease?token=${encodeURIComponent(token)}`;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: "Full lease download",
            description: "One-time download of your generated tenancy agreement (PDF).",
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: token,
    metadata: { lease_token: token },
  });

  await supabase
    .from("lease_download_tokens")
    .update({ stripe_session_id: session.id })
    .eq("token", token);

  return res.status(200).json({ url: session.url });
}
