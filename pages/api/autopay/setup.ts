import { getAdminClient } from "../../../lib/apiAuth";
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

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const rentScheduleId = typeof body.rentScheduleId === "string" ? body.rentScheduleId.trim() : "";
  const tenantEmail = typeof body.tenantEmail === "string" ? body.tenantEmail.trim().toLowerCase() : "";
  if (!rentScheduleId || !tenantEmail) return json({ error: "rentScheduleId and tenantEmail required" }, 400);

  const admin = getAdminClient();
  const { data: schedule } = await admin
    .from("rent_schedules")
    .select("id, tenant_id, tenants ( id, email )")
    .eq("id", rentScheduleId)
    .maybeSingle();

  if (!schedule) return json({ error: "Rent schedule not found" }, 404);
  const s = schedule as { tenants: { id: string; email: string } | null };
  const tenantEmailFromSchedule = s.tenants?.email?.toLowerCase();
  if (tenantEmailFromSchedule !== tenantEmail) return json({ error: "Email does not match schedule tenant" }, 403);

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  const { data: existingCustomer } = await admin
    .from("autopay_mandates")
    .select("stripe_customer_id")
    .eq("tenant_id", s.tenants!.id)
    .eq("rent_schedule_id", rentScheduleId)
    .eq("is_active", true)
    .maybeSingle();

  let customerId = (existingCustomer as { stripe_customer_id: string } | null)?.stripe_customer_id;
  if (!customerId) {
    const custRes = await fetch("https://api.stripe.com/v1/customers", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        email: tenantEmail,
        "metadata[tenant_id]": s.tenants!.id,
        "metadata[rent_schedule_id]": rentScheduleId
      }).toString()
    });
    if (!custRes.ok) {
      console.error("Stripe customer:", await custRes.text());
      return json({ error: "Failed to create customer" }, 502);
    }
    const cust = (await custRes.json()) as { id: string };
    customerId = cust.id;
  }

  const form = new URLSearchParams();
  form.set("customer", customerId);
  form.append("payment_method_types[]", "card");
  form.append("payment_method_types[]", "us_bank_account");
  form.set("metadata[rent_schedule_id]", rentScheduleId);
  form.set("metadata[tenant_id]", s.tenants!.id);

  const siRes = await fetch("https://api.stripe.com/v1/setup_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!siRes.ok) {
    console.error("Stripe setup_intent:", await siRes.text());
    return json({ error: "Failed to create setup intent" }, 502);
  }

  const si = (await siRes.json()) as { client_secret: string };
  return json({ clientSecret: si.client_secret, stripeCustomerId: customerId });
}
