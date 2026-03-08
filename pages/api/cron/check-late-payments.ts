import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { sendLatePaymentReminderEmail, sendLatePaymentLandlordAlertEmail } from "../../../lib/email";

export const runtime = "edge";

const CRON_SECRET_HEADER = "x-cron-secret";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const env = getEnv();
  const secret = env.CRON_SECRET ?? process.env.CRON_SECRET;
  const provided = req.headers.get(CRON_SECRET_HEADER) ?? req.headers.get("X-Cron-Secret");
  if (!secret || provided !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = getAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: schedules } = await db
    .from("rent_schedules")
    .select(`
      id,
      amount_cents,
      late_fee_cents,
      late_fee_grace_days,
      due_day_of_month,
      currency,
      property_id,
      landlord_id,
      tenant_id,
      properties ( address, city, state, zip ),
      tenants ( first_name, last_name, email ),
      landlords ( email )
    `)
    .eq("is_active", true);

  const emailOpts = {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>"
  };

  let processed = 0;
  for (const s of schedules ?? []) {
    const schedule = s as {
      id: string;
      amount_cents: number;
      late_fee_cents: number;
      late_fee_grace_days: number;
      due_day_of_month: number;
      property_id: string;
      landlord_id: string;
      tenant_id: string | null;
      properties: { address: string; city: string; state: string; zip: string } | null;
      tenants: { first_name: string; last_name: string; email: string } | null;
      landlords: { email: string } | null;
    };

    const dueDay = schedule.due_day_of_month ?? 1;
    const [y, m] = today.split("-").map(Number);
    const dueDate = new Date(y, m - 1, Math.min(dueDay, 28));
    const dueDateStr = dueDate.toISOString().slice(0, 10);
    const graceDays = schedule.late_fee_grace_days ?? 5;
    const graceEnd = new Date(dueDate);
    graceEnd.setDate(graceEnd.getDate() + graceDays);
    const graceEndStr = graceEnd.toISOString().slice(0, 10);

    if (today <= graceEndStr) continue;

    const { data: existingPayment } = await db
      .from("rent_payments")
      .select("id, status")
      .eq("rent_schedule_id", schedule.id)
      .gte("due_date", dueDateStr)
      .lte("due_date", dueDateStr)
      .maybeSingle();

    if (existingPayment && (existingPayment as { status: string }).status === "succeeded") continue;

    const rentPaymentId = (existingPayment as { id: string } | null)?.id;
    const amountCents = schedule.amount_cents;
    const lateFeeCents = schedule.late_fee_cents ?? 5000;
    const propertyAddress = schedule.properties
      ? `${schedule.properties.address}, ${schedule.properties.city}, ${schedule.properties.state} ${schedule.properties.zip}`
      : "";
    const tenantName = schedule.tenants ? `${schedule.tenants.first_name} ${schedule.tenants.last_name}`.trim() : "";
    const tenantEmail = schedule.tenants?.email;
    const landlordEmail = schedule.landlords?.email;

    const daysLate = Math.max(0, Math.ceil((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
    const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((amountCents + lateFeeCents) / 100);
    const lateFeeFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(lateFeeCents / 100);
    const origin = env.NEXT_PUBLIC_APP_URL ?? "https://rentlease.app";
    const paymentUrl = `${origin}/pay/${rentPaymentId ?? ""}`;

    if (rentPaymentId) {
      await db
        .from("rent_payments")
        .update({ late_fee_cents: lateFeeCents })
        .eq("id", rentPaymentId);
      if (tenantEmail) {
        sendLatePaymentReminderEmail(tenantEmail, tenantName, amountFormatted, lateFeeFormatted, dueDateStr, propertyAddress, paymentUrl, emailOpts).catch(console.error);
      }
      if (landlordEmail) {
        sendLatePaymentLandlordAlertEmail(landlordEmail, tenantName, amountFormatted, daysLate, propertyAddress, emailOpts).catch(console.error);
      }
      processed++;
    } else {
      const { data: newPay } = await db
        .from("rent_payments")
        .insert({
          rent_schedule_id: schedule.id,
          landlord_id: schedule.landlord_id,
          property_id: schedule.property_id,
          tenant_id: schedule.tenant_id,
          amount_cents: amountCents,
          late_fee_cents: lateFeeCents,
          currency: schedule.currency ?? "usd",
          status: "pending",
          due_date: dueDateStr
        })
        .select("id")
        .single();
      if (newPay) {
        const paymentId = (newPay as { id: string }).id;
        const newPaymentUrl = `${origin}/pay/${paymentId}`;
        if (tenantEmail) {
          sendLatePaymentReminderEmail(
            tenantEmail,
            tenantName,
            amountFormatted,
            lateFeeFormatted,
            dueDateStr,
            propertyAddress,
            newPaymentUrl,
            emailOpts
          ).catch(console.error);
        }
        if (landlordEmail) {
          sendLatePaymentLandlordAlertEmail(
            landlordEmail,
            tenantName,
            amountFormatted,
            daysLate,
            propertyAddress,
            emailOpts
          ).catch(console.error);
        }
        processed++;
      }
    }
  }

  return json({ ok: true, processed });
}
