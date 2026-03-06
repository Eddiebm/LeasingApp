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
  const documentText = String(body.documentText ?? "").trim();
  const documentType = String(body.documentType ?? "").trim();
  if (!documentText || !documentType) {
    return res.status(400).json({ error: "Missing documentText or documentType." });
  }

  const isLease =
    documentType === "ast_lease" ||
    documentType === "rent_increase" ||
    documentType === "lease";
  const amountPence = isLease ? 1500 : 1000; // £15 lease / £10 eviction

  const supabase = getSupabaseServer();
  const { data: row, error: insertError } = await supabase
    .from("document_download_tokens")
    .insert({ document_text: documentText, document_type: documentType })
    .select("token")
    .single();

  if (insertError || !row?.token) {
    console.error("document_download_tokens insert:", insertError);
    return res.status(500).json({ error: "Could not create download." });
  }

  const origin = (req.headers.origin || req.headers.referer || "").replace(/\/$/, "") || "http://localhost:3000";
  const token = row.token;
  const successUrl = `${origin}/documents?paid=1&token=${encodeURIComponent(token)}`;
  const cancelUrl = `${origin}/documents?token=${encodeURIComponent(token)}`;

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          unit_amount: amountPence,
          product_data: {
            name: isLease ? "Lease download" : "Eviction notice download",
            description: "One-time PDF download of your generated document.",
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: token,
    metadata: { document_token: token },
  });

  await supabase
    .from("document_download_tokens")
    .update({ stripe_session_id: session.id })
    .eq("token", token);

  return res.status(200).json({ url: session.url });
}
