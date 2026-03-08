import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin") || !auth.landlord) {
    return json({ error: "Unauthorized" }, 401);
  }

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  const landlordCountry = auth.landlord.country === "US" ? "US" : "UK";
  const priceId =
    landlordCountry === "US"
      ? (env.STRIPE_SUBSCRIPTION_PRICE_ID_USD || process.env.STRIPE_SUBSCRIPTION_PRICE_ID_USD)
      : (env.STRIPE_SUBSCRIPTION_PRICE_ID || process.env.STRIPE_SUBSCRIPTION_PRICE_ID);

  if (!stripeKey || !priceId) {
    return json({ error: "Billing not configured" }, 503);
  }

  const landlordId = auth.landlord.id;
  const email = auth.landlord.email;
  let customerId = auth.landlord.stripe_customer_id ?? null;

  const adminClient = getAdminClient();

  if (!customerId) {
    const custRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        email: email ?? "",
        "metadata[landlord_id]": landlordId,
      }).toString(),
    });
    if (!custRes.ok) {
      console.error("Stripe create customer:", await custRes.text());
      return json({ error: "Failed to create billing account." }, 502);
    }
    const customer = (await custRes.json()) as { id: string };
    customerId = customer.id;
    await adminClient
      .from("landlords")
      .update({ stripe_customer_id: customerId })
      .eq("id", landlordId);
  }

  const origin =
    (req.headers.get("origin") || req.headers.get("referer") || "").replace(/\/$/, "") ||
    "https://rentlease.app";

  const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "subscription",
      customer: customerId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/dashboard/billing?success=1`,
      cancel_url: `${origin}/dashboard/billing?canceled=1`,
      "metadata[landlord_id]": landlordId,
      "subscription_data[metadata][landlord_id]": landlordId,
    }).toString(),
  });

  if (!sessionRes.ok) {
    console.error("Stripe create session:", await sessionRes.text());
    return json({ error: "Failed to create checkout session." }, 502);
  }

  const session = (await sessionRes.json()) as { url: string };
  return json({ url: session.url });
}
