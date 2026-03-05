export const runtime = "edge";

import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!stripe) return res.status(503).json({ error: "Billing not configured" });

  const customerId = auth.landlord.stripe_customer_id;
  if (!customerId) {
    return res.status(400).json({ error: "No billing account. Subscribe first." });
  }

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:3000";
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/dashboard/billing`
  });

  return res.status(200).json({ url: session.url });
}
