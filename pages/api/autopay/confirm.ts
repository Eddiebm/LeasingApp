import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { sendAutopayConfirmationEmail } from "../../../lib/email";

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
  const stripeCustomerId = typeof body.stripeCustomerId === "string" ? body.stripeCustomerId.trim() : "";
  const paymentMethodId = typeof body.paymentMethodId === "string" ? body.paymentMethodId.trim() : "";
  const setupIntentId = typeof body.setupIntentId === "string" ? body.setupIntentId.trim() : "";
  let paymentMethod = (body.paymentMethod as string) === "ach" ? "ach" as const : "card" as const;

  if (!rentScheduleId) return json({ error: "rentScheduleId required" }, 400);
  if (!stripeCustomerId) return json({ error: "stripeCustomerId required" }, 400);

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  let resolvedPaymentMethodId = paymentMethodId;
  if (!resolvedPaymentMethodId && setupIntentId) {
    const siRes = await fetch(`https://api.stripe.com/v1/setup_intents/${setupIntentId}`, {
      headers: { Authorization: `Bearer ${stripeKey}` }
    });
    if (!siRes.ok) return json({ error: "Invalid setup intent" }, 400);
    const si = (await siRes.json()) as { payment_method: string; payment_method_types?: string[] };
    resolvedPaymentMethodId = si.payment_method;
    if (Array.isArray(si.payment_method_types) && si.payment_method_types.includes("us_bank_account")) paymentMethod = "ach";
  }
  if (!resolvedPaymentMethodId) return json({ error: "paymentMethodId or setupIntentId required" }, 400);

  const admin = getAdminClient();
  const { data: schedule } = await admin
    .from("rent_schedules")
    .select(`
      id,
      tenant_id,
      amount_cents,
      due_day_of_month,
      properties ( address, city, state, zip ),
      tenants ( first_name, last_name, email ),
      landlords ( email )
    `)
    .eq("id", rentScheduleId)
    .maybeSingle();

  if (!schedule) return json({ error: "Rent schedule not found" }, 404);

  const s = schedule as {
    id: string;
    tenant_id: string;
    amount_cents: number;
    due_day_of_month: number;
    properties: { address: string; city: string; state: string; zip: string } | null;
    tenants: { first_name: string; last_name: string; email: string } | null;
    landlords: { email: string } | null;
  };

  const { error: mandateErr } = await admin.from("autopay_mandates").insert({
    tenant_id: s.tenant_id,
    rent_schedule_id: rentScheduleId,
    stripe_customer_id: stripeCustomerId,
    stripe_payment_method_id: resolvedPaymentMethodId,
    payment_method: paymentMethod,
    is_active: true
  });

  if (mandateErr) {
    console.error(mandateErr);
    return json({ error: mandateErr.message }, 500);
  }

  await admin
    .from("rent_schedules")
    .update({ autopay_enabled: true, updated_at: new Date().toISOString() })
    .eq("id", rentScheduleId);

  const propertyAddress = s.properties ? `${s.properties.address}, ${s.properties.city}, ${s.properties.state} ${s.properties.zip}` : "";
  const tenantName = s.tenants ? `${s.tenants.first_name} ${s.tenants.last_name}`.trim() : "";
  const tenantEmail = s.tenants?.email;
  const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(s.amount_cents / 100);
  const dueDay = s.due_day_of_month ?? 1;

  if (tenantEmail) {
    sendAutopayConfirmationEmail(tenantEmail, tenantName, amountFormatted, dueDay, propertyAddress, {
      resendApiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>"
    }).catch(console.error);
  }

  if (s.landlords?.email) {
    const resend = await import("resend").then((m) => new m.Resend(env.RESEND_API_KEY));
    resend.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [s.landlords.email],
        subject: `Autopay set up — ${propertyAddress}`,
        html: `<p>${tenantName} has set up autopay for rent at ${propertyAddress} (${amountFormatted} on the ${dueDay}th of each month).</p>`
      })
      .catch(console.error);
  }

  return json({ success: true });
}
