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
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin") || !auth.landlord) return json({ error: "Unauthorized" }, 401);

  // Try to get accountId from the auth record first
  let accountId = auth.landlord.stripe_connect_account_id ?? null;

  // If not in the hardcoded/cached record, fetch fresh from DB (handles case where
  // create-account just ran and updated the DB but the hardcoded record is stale)
  if (!accountId && auth.landlordId) {
    try {
      const admin = getAdminClient();
      const { data: freshLandlord } = await admin
        .from("landlords")
        .select("stripe_connect_account_id")
        .eq("id", auth.landlordId)
        .maybeSingle();
      accountId = freshLandlord?.stripe_connect_account_id ?? null;
    } catch { /* fall through */ }
  }

  // Also accept accountId passed in request body as a last resort
  if (!accountId) {
    try {
      const body = await req.json().catch(() => ({})) as { accountId?: string };
      if (body.accountId) accountId = body.accountId;
    } catch { /* ignore */ }
  }

  if (!accountId) return json({ error: "No Connect account. Create one first." }, 400);

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
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
