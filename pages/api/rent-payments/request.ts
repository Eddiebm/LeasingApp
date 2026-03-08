import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { sendRentPaymentRequestEmail } from "../../../lib/email";

export const runtime = "edge";

const PLATFORM_FEE_ACH_CENTS = 200;
const PLATFORM_FEE_CARD_PERCENT = 3.5;

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

  const landlord = auth.landlord;
  if (!landlord.stripe_connect_charges_enabled) {
    return json({ error: "Connect account must have charges enabled. Complete onboarding in Billing." }, 400);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const rentScheduleId = typeof body.rentScheduleId === "string" ? body.rentScheduleId.trim() : "";
  const periodStart = typeof body.periodStart === "string" ? body.periodStart.trim() : "";
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd.trim() : "";
  const includeLateFee = body.includeLateFee === true;

  if (!rentScheduleId) return json({ error: "rentScheduleId required" }, 400);

  const admin = getAdminClient();
  const { data: schedule, error: sErr } = await admin
    .from("rent_schedules")
    .select(`
      id,
      landlord_id,
      property_id,
      tenant_id,
      amount_cents,
      currency,
      late_fee_cents,
      late_fee_grace_days,
      properties ( address, city, state, zip ),
      tenants ( id, first_name, last_name, email )
    `)
    .eq("id", rentScheduleId)
    .maybeSingle();

  if (sErr || !schedule) return json({ error: "Rent schedule not found" }, 404);
  const s = schedule as { landlord_id: string };
  if (s.landlord_id !== auth.landlordId) return json({ error: "Forbidden" }, 403);

  const amountCents = (schedule as { amount_cents: number }).amount_cents;
  const lateFeeCents = includeLateFee ? ((schedule as { late_fee_cents: number }).late_fee_cents ?? 0) : 0;
  const totalCents = amountCents + lateFeeCents;
  const currency = (schedule as { currency: string }).currency ?? "usd";
  const property = (schedule as { properties: { address: string; city: string; state: string; zip: string } | null }).properties;
  const tenant = (schedule as { tenants: { first_name: string; last_name: string; email: string } | null }).tenants;
  const propertyAddress = property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "";
  const tenantEmail = tenant?.email;
  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "";

  if (!tenantEmail) return json({ error: "No tenant assigned to this schedule" }, 400);

  const dueDate = periodEnd ? new Date(periodEnd) : new Date();
  const periodLabel = periodStart && periodEnd
    ? `${new Date(periodStart).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`
    : dueDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const { data: paymentRow, error: payErr } = await admin
    .from("rent_payments")
    .insert({
      rent_schedule_id: rentScheduleId,
      landlord_id: s.landlord_id,
      property_id: (schedule as { property_id: string }).property_id,
      tenant_id: (schedule as { tenant_id: string | null }).tenant_id,
      amount_cents: amountCents,
      late_fee_cents: lateFeeCents,
      platform_fee_cents: 0,
      currency,
      status: "pending",
      due_date: periodEnd ? periodEnd.slice(0, 10) : null,
      period_start: periodStart || null,
      period_end: periodEnd || null
    })
    .select("id")
    .single();

  if (payErr || !paymentRow) {
    console.error(payErr);
    return json({ error: "Failed to create payment record" }, 500);
  }

  const paymentId = (paymentRow as { id: string }).id;
  const env = getEnv();
  const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://rentlease.app";
  const paymentUrl = `${origin}/pay/${paymentId}`;

  const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(totalCents / 100);

  sendRentPaymentRequestEmail(
    tenantEmail,
    tenantName,
    amountFormatted,
    periodLabel,
    propertyAddress,
    paymentUrl,
    { resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>" }
  ).catch(console.error);

  return json({
    paymentId,
    clientSecret: null,
    message: "Payment request sent to tenant. Tenant will get clientSecret when they open the pay page and choose a payment method."
  });
}
