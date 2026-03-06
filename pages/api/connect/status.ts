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
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) return json({ error: "Unauthorized" }, 401);

  const accountId = auth.landlord.stripe_connect_account_id;
  if (!accountId) {
    return json({ chargesEnabled: false, payoutsEnabled: false, onboarded: false });
  }

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
    headers: { Authorization: `Bearer ${stripeKey}` }
  });

  if (!res.ok) {
    return json({ chargesEnabled: false, payoutsEnabled: false, onboarded: false });
  }

  const account = (await res.json()) as { charges_enabled?: boolean; payouts_enabled?: boolean };
  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;
  const onboarded = chargesEnabled && payoutsEnabled;

  const admin = getAdminClient();
  await admin
    .from("landlords")
    .update({
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled,
      stripe_connect_onboarded: onboarded
    })
    .eq("id", auth.landlordId);

  return json({ chargesEnabled, payoutsEnabled, onboarded });
}
