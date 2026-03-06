import { getLandlordOrAdmin } from "../../../lib/apiAuth";
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
  if (!auth || auth.role !== "landlord" || !auth.landlord) {
    return json({ error: "Unauthorized" }, 401);
  }

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Billing not configured" }, 503);

  const customerId = auth.landlord.stripe_customer_id;
  if (!customerId) {
    return json({ error: "No billing account. Subscribe first." }, 400);
  }

  const origin =
    (req.headers.get("origin") || req.headers.get("referer") || "").replace(/\/$/, "") ||
    "https://leasingapp.pages.dev";

  const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      customer: customerId,
      return_url: `${origin}/dashboard/billing`,
    }).toString(),
  });

  if (!portalRes.ok) {
    console.error("Stripe portal session:", await portalRes.text());
    return json({ error: "Failed to create billing portal session." }, 502);
  }

  const session = (await portalRes.json()) as { url: string };
  return json({ url: session.url });
}
