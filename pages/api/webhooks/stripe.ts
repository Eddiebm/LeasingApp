export const runtime = "edge";

import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { runScreening } from "../../../lib/runScreening";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function parseStripeSignature(header: string): { t: string; v1: string } | null {
  const parts: Record<string, string> = {};
  for (const p of header.split(",")) {
    const [k, v] = p.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  if (parts.t && parts.v1) return { t: parts.t, v1: parts.v1 };
  return null;
}

async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parsed = parseStripeSignature(signature);
  if (!parsed) return false;
  const signedPayload = `${parsed.t}.${payload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === parsed.v1;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const env = getEnv();
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return json({ error: "Webhook not configured" }, 503);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  if (!sigHeader) return json({ error: "Missing signature" }, 400);

  const ok = await verifyStripeWebhook(rawBody, sigHeader, webhookSecret);
  if (!ok) {
    console.error("Stripe webhook signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: {
    type: string;
    data?: {
      object?: {
        metadata?: { paymentId?: string; rentPaymentId?: string };
        customer?: string;
        status?: string;
        current_period_end?: number;
      };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const db = getAdminClient();
  const env = getEnv();

  if (event.type === "payment_intent.succeeded") {
    const obj = event.data?.object as { metadata?: { rentPaymentId?: string; paymentId?: string } };
    const rentPaymentId = obj?.metadata?.rentPaymentId;
    if (rentPaymentId) {
      const now = new Date().toISOString();
      await db.from("rent_payments").update({ status: "succeeded", paid_at: now }).eq("id", rentPaymentId);

      const { data: rp } = await db
        .from("rent_payments")
        .select(`
          amount_cents,
          late_fee_cents,
          currency,
          period_start,
          period_end,
          landlord_id,
          tenants ( first_name, last_name, email ),
          properties ( address, city, state, zip ),
          landlords ( email, full_name )
        `)
        .eq("id", rentPaymentId)
        .single();

      if (rp && env.RESEND_API_KEY) {
        const R = rp as {
          amount_cents: number;
          late_fee_cents: number;
          currency: string;
          period_start: string | null;
          period_end: string | null;
          tenants: { first_name: string; last_name: string; email: string } | null;
          properties: { address: string; city: string; state: string; zip: string } | null;
          landlords: { email: string; full_name: string } | null;
        };
        const totalCents = R.amount_cents + (R.late_fee_cents ?? 0);
        const amountFormatted = new Intl.NumberFormat("en-US", { style: "currency", currency: (R.currency || "usd").toUpperCase() }).format(totalCents / 100);
        const period = R.period_start && R.period_end
          ? new Date(R.period_start).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "";
        const propertyAddress = R.properties ? `${R.properties.address}, ${R.properties.city}, ${R.properties.state} ${R.properties.zip}` : "";
        const tenantName = R.tenants ? `${R.tenants.first_name} ${R.tenants.last_name}`.trim() : "";
        const tenantEmail = R.tenants?.email;
        const landlordEmail = R.landlords?.email;
        const landlordName = R.landlords?.full_name ?? "Landlord";
        const emailOpts = { resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>" };
        const { sendRentReceiptEmail, sendRentPaidNotificationEmail } = await import("../../../lib/email");
        if (tenantEmail) sendRentReceiptEmail(tenantEmail, tenantName, amountFormatted, period, propertyAddress, now, emailOpts).catch(console.error);
        if (landlordEmail) sendRentPaidNotificationEmail(landlordEmail, tenantName, amountFormatted, period, propertyAddress, emailOpts).catch(console.error);
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const obj = event.data?.object as { metadata?: { rentPaymentId?: string } };
    const rentPaymentId = obj?.metadata?.rentPaymentId;
    if (rentPaymentId) {
      await db.from("rent_payments").update({ status: "failed" }).eq("id", rentPaymentId);
      const { data: rp } = await db
        .from("rent_payments")
        .select("tenants ( first_name, last_name, email ), properties ( address, city, state, zip ), landlords ( email )")
        .eq("id", rentPaymentId)
        .single();
      if (rp && env.RESEND_API_KEY) {
        const R = rp as {
          tenants: { first_name: string; last_name: string; email: string } | null;
          properties: { address: string; city: string; state: string; zip: string } | null;
          landlords: { email: string } | null;
        };
        const tenantEmail = R.tenants?.email;
        const landlordEmail = R.landlords?.email;
        const tenantName = R.tenants ? `${R.tenants.first_name} ${R.tenants.last_name}`.trim() : "";
        const propertyAddress = R.properties ? `${R.properties.address}, ${R.properties.city}, ${R.properties.state} ${R.properties.zip}` : "";
        const emailOpts = { resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>" };
        const { sendLatePaymentLandlordAlertEmail } = await import("../../../lib/email");
        if (tenantEmail) {
          const resend = await import("resend").then((m) => new m.Resend(env.RESEND_API_KEY));
          resend.emails.send({
            from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
            to: [tenantEmail],
            subject: `Payment failed — ${propertyAddress}`,
            html: `<p>Hi ${tenantName},</p><p>Your recent rent payment attempt for ${propertyAddress} did not succeed. Please try again or use a different payment method.</p>`
          }).catch(console.error);
        }
        if (landlordEmail) sendLatePaymentLandlordAlertEmail(landlordEmail, tenantName, "—", 0, propertyAddress, emailOpts).catch(console.error);
      }
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data?.object as { customer?: string; status?: string; current_period_end?: number } | undefined;
    if (sub?.customer) {
      const { data: landlord } = await db
        .from("landlords")
        .select("id")
        .eq("stripe_customer_id", sub.customer)
        .maybeSingle();
      if (landlord) {
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status ?? "inactive";
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await db
          .from("landlords")
          .update({
            subscription_status: status,
            subscription_current_period_end: periodEnd
          })
          .eq("id", landlord.id);
      }
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const obj = event.data?.object as { metadata?: { paymentId?: string } };
    const paymentId = obj?.metadata?.paymentId;
    if (paymentId) {
      await db
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);

      const { data: payment } = await db
        .from("payments")
        .select("application_id, payment_type, amount_cents, currency")
        .eq("id", paymentId)
        .single();

      if (payment && (payment as { payment_type: string }).payment_type === "screening_fee") {
        const applicationId = (payment as { application_id: string }).application_id;
        const { data: app } = await db
          .from("applications")
          .select("id, tenants ( id, first_name, last_name, dob )")
          .eq("id", applicationId)
          .single();
        if (app) {
          const tenant = (app as { tenants: { id: string; first_name: string; last_name: string; dob: string } | null }).tenants;
          if (tenant?.dob && tenant.id) {
            try {
              const screenData = await runScreening({
                firstName: tenant.first_name,
                lastName: tenant.last_name,
                dob: tenant.dob
              });

              await db
                .from("applications")
                .update({
                  credit_score: screenData.credit_score ?? null,
                  background_result: {
                    evictions: screenData.evictions,
                    criminal_record: screenData.criminal_record
                  }
                })
                .eq("id", applicationId);

              const providerName = env.RENTPREP_API_KEY ? "rentprep" : env.CHECKR_API_KEY ? "checkr" : "mock";
              const { data: screeningRow } = await db
                .from("tenant_screenings")
                .insert({
                  tenant_id: tenant.id,
                  application_id: applicationId,
                  jurisdiction: null,
                  provider: providerName,
                  status: "completed",
                  started_at: new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                  amount_cents: (payment as { amount_cents?: number }).amount_cents ?? null,
                  currency: (payment as { currency?: string }).currency ?? null
                })
                .select("id")
                .single();

              const screeningId = (screeningRow as { id: string } | null)?.id ?? null;

              if (screeningId) {
                await db.from("screening_reports").insert({
                  tenant_screening_id: screeningId,
                  summary: {
                    credit_score: screenData.credit_score,
                    evictions: screenData.evictions,
                    criminal_record: screenData.criminal_record
                  }
                });

                const now = new Date();
                const expiry = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
                const { data: existingPassport } = await db
                  .from("tenant_passports")
                  .select("id, passport_expiry_date")
                  .eq("tenant_id", tenant.id)
                  .gt("passport_expiry_date", now.toISOString())
                  .maybeSingle();

                if (existingPassport) {
                  await db
                    .from("tenant_passports")
                    .update({
                      identity_verified: true,
                      credit_score: screenData.credit_score,
                      income_verified: null,
                      eviction_history: screenData.evictions,
                      criminal_records: screenData.criminal_record,
                      right_to_rent: null,
                      screening_provider: providerName,
                      last_screening_id: screeningId,
                      passport_expiry_date: expiry.toISOString(),
                      updated_at: now.toISOString()
                    })
                    .eq("id", (existingPassport as { id: string }).id);
                } else {
                  await db.from("tenant_passports").insert({
                    tenant_id: tenant.id,
                    identity_verified: true,
                    credit_score: screenData.credit_score,
                    income_verified: null,
                    eviction_history: screenData.evictions,
                    criminal_records: screenData.criminal_record,
                    right_to_rent: null,
                    screening_provider: providerName,
                    last_screening_id: screeningId,
                    passport_expiry_date: expiry.toISOString()
                  });
                }
              }
            } catch (e) {
              console.error("Screening after payment error", e);
            }
          }
        }
      }
    }
  }

  return json({ received: true });
}
