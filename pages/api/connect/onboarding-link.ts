import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) return json({ error: "Unauthorized" }, 401);

  const accountId = auth.landlord.stripe_connect_account_id;
  if (!accountId) return json({ error: "No Connect account. Create one first." }, 400);

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://leasingapp.pages.dev";
  const refreshUrl = `${origin}/dashboard/billing?connect=refresh`;
  const returnUrl = `${origin}/dashboard/billing?connect=success`;

  const res = await fetch("https://api.stripe.com/v1/account_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding"
    }).toString()
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Stripe account_links:", err);
    return json({ error: "Failed to create onboarding link" }, 502);
  }

  const data = (await res.json()) as { url: string };
  return json({ url: data.url });
}
