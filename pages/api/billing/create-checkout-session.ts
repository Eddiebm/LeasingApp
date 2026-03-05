import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { supabaseServer } from "../../../lib/supabaseServer";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;
const priceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!stripe || !priceId) {
    return res.status(503).json({ error: "Billing not configured" });
  }

  const landlordId = auth.landlord.id;
  const email = auth.landlord.email;
  let customerId = auth.landlord.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { landlord_id: landlordId }
    });
    customerId = customer.id;
    await supabaseServer
      .from("landlords")
      .update({ stripe_customer_id: customerId })
      .eq("id", landlordId);
  }

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, "") || "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/dashboard/billing?success=1`,
    cancel_url: `${origin}/dashboard/billing?canceled=1`,
    metadata: { landlord_id: landlordId },
    subscription_data: { metadata: { landlord_id: landlordId } }
  });

  return res.status(200).json({ url: session.url });
}
