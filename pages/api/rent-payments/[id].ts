import { getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getPaymentId(req: Request): string {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const idx = segments.indexOf("rent-payments") + 1;
  return segments[idx] ?? "";
}

export default async function handler(req: Request) {
  const paymentId = getPaymentId(req).trim();
  if (!paymentId) return json({ error: "Payment ID required" }, 400);

  const admin = getAdminClient();
  const { data: payment, error } = await admin
    .from("rent_payments")
    .select(`
      id,
      rent_schedule_id,
      amount_cents,
      late_fee_cents,
      platform_fee_cents,
      currency,
      status,
      stripe_payment_intent_id,
      due_date,
      period_start,
      period_end,
      paid_at,
      properties ( address, city, state, zip ),
      tenants ( first_name, last_name, email )
    `)
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) return json({ error: "Payment not found" }, 404);

  const p = payment as {
    id: string;
    amount_cents: number;
    late_fee_cents: number;
    platform_fee_cents: number;
    currency: string;
    status: string;
    stripe_payment_intent_id: string | null;
    due_date: string | null;
    period_start: string | null;
    period_end: string | null;
    paid_at: string | null;
    properties: { address: string; city: string; state: string; zip: string } | null;
    tenants: { first_name: string; last_name: string; email: string } | null;
  };

  const totalCents = p.amount_cents + (p.late_fee_cents ?? 0);
  const periodLabel =
    p.period_start && p.period_end
      ? new Date(p.period_start).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : p.due_date
        ? new Date(p.due_date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "";

  const propertyAddress = p.properties
    ? `${p.properties.address}, ${p.properties.city}, ${p.properties.state} ${p.properties.zip}`
    : "";

  const tenantEmail = p.tenants?.email ?? null;

  const achFeeCents = 200;
  const cardFeeCents = Math.round(totalCents * 0.035);
  if (req.method === "GET") {
    return json({
      id: p.id,
      rentScheduleId: (p as { rent_schedule_id?: string }).rent_schedule_id ?? null,
      amount: p.amount_cents,
      lateFee: p.late_fee_cents ?? 0,
      platformFeeAchCents: achFeeCents,
      platformFeeCardCents: cardFeeCents,
      totalCents,
      totalWithAchCents: totalCents + achFeeCents,
      totalWithCardCents: totalCents + cardFeeCents,
      currency: p.currency,
      period: periodLabel,
      propertyAddress,
      tenantEmail,
      status: p.status,
      clientSecret: null,
      paidAt: p.paid_at
    });
  }

  return new Response(null, { status: 405 });
}
