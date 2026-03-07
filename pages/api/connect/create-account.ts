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

  const landlord = auth.landlord;
  if (landlord.stripe_connect_account_id) {
    return json({ error: "Stripe Connect account already exists", accountId: landlord.stripe_connect_account_id }, 400);
  }

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  const country = (landlord.country === "UK" || landlord.country === "GB") ? "GB" : "US";

  const res = await fetch("https://api.stripe.com/v1/accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      type: "express",
      country,
      email: landlord.email ?? "",
      "capabilities[card_payments][requested]": "true",
      "capabilities[transfers][requested]": "true",
      "capabilities[us_bank_account_ach_payments][requested]": "true"
    }).toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Stripe create account:", errText);
    let stripeMsg = "Failed to create Connect account";
    try { const errJson = JSON.parse(errText); stripeMsg = errJson?.error?.message || stripeMsg; } catch {}
    return json({ error: stripeMsg, stripeKey: stripeKey ? stripeKey.substring(0, 12) + '...' : 'MISSING' }, 502);
  }

  const account = (await res.json()) as { id: string };
  const admin = getAdminClient();
  await admin
    .from("landlords")
    .update({ stripe_connect_account_id: account.id })
    .eq("id", auth.landlordId);

  return json({ accountId: account.id });
}
