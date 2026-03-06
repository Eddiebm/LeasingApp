export const runtime = "edge";

import { getAdminClient } from "../../../lib/apiAuth";
import { getSupabaseServer } from "../../../lib/supabaseServer";

// Run on Node so raw body is available (required for Stripe signature verification).
// On Cloudflare Pages/Edge, use a separate Node webhook endpoint (see docs/WEBHOOK.md).
export const config = { api: { bodyParser: false } };

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });
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
        metadata?: { paymentId?: string };
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

  // SaaS billing: sync subscription status to landlords
  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data?.object as { customer?: string; status?: string; current_period_end?: number } | undefined;
    if (sub?.customer) {
      const { data: landlord } = await getSupabaseServer()
        .from("landlords")
        .select("id")
        .eq("stripe_customer_id", sub.customer)
        .maybeSingle();
      if (landlord) {
        const status = event.type === "customer.subscription.deleted" ? "canceled" : sub.status ?? "inactive";
        const periodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;
        await getSupabaseServer()
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
    const paymentId = event.data?.object?.metadata?.paymentId;
    if (paymentId) {
      await getAdminClient()
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);

      const { data: payment } = await getSupabaseServer()
        .from("payments")
        .select("application_id, payment_type, amount_cents, currency")
        .eq("id", paymentId)
        .single();

      if (payment && (payment as { payment_type: string }).payment_type === "screening_fee") {
        const applicationId = (payment as { application_id: string }).application_id;
        const { data: app } = await getSupabaseServer()
          .from("applications")
          .select("id, tenants ( id, first_name, last_name, dob )")
          .eq("id", applicationId)
          .single();
        if (app) {
          const tenant = (app as { tenants: { id: string; first_name: string; last_name: string; dob: string } | null }).tenants;
          if (tenant?.dob && tenant.id) {
            try {
              const { runScreening } = await import("../../../lib/runScreening");
              const screenData = await runScreening({
                firstName: tenant.first_name,
                lastName: tenant.last_name,
                dob: tenant.dob
              });

              // Persist legacy fields on applications for backward-compatible UI.
              const supabaseServer = getSupabaseServer();
              await supabaseServer
                .from("applications")
                .update({
                  credit_score: screenData.credit_score ?? null,
                  background_result: {
                    evictions: screenData.evictions,
                    criminal_record: screenData.criminal_record
                  }
                })
                .eq("id", applicationId);

              // Create a tenant_screenings row to track this screening event.
              const screeningInsert = await supabaseServer
                .from("tenant_screenings")
                .insert({
                  tenant_id: tenant.id,
                  application_id: applicationId,
                  jurisdiction: null,
                  provider: process.env.RENTPREP_API_KEY ? "rentprep" : process.env.CHECKR_API_KEY ? "checkr" : "mock",
                  status: "completed",
                  started_at: new Date().toISOString(),
                  completed_at: new Date().toISOString(),
                  amount_cents: (payment as { amount_cents?: number }).amount_cents ?? null,
                  currency: (payment as { currency?: string }).currency ?? null
                })
                .select("id")
                .single();

              const screeningId =
                (screeningInsert.data as { id: string } | null)?.id ?? null;

              if (screeningId) {
                // Save a normalized summary; raw_encrypted left null until real provider wiring is added.
                await supabaseServer.from("screening_reports").insert({
                  tenant_screening_id: screeningId,
                  summary: {
                    credit_score: screenData.credit_score,
                    evictions: screenData.evictions,
                    criminal_record: screenData.criminal_record
                  }
                });

                // Upsert tenant_passport for this tenant.
                const now = new Date();
                const expiry = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // ~45 days
                const { data: existingPassport } = await supabaseServer
                  .from("tenant_passports")
                  .select("id, passport_expiry_date")
                  .eq("tenant_id", tenant.id)
                  .gt("passport_expiry_date", now.toISOString())
                  .maybeSingle();

                if (existingPassport) {
                  await supabaseServer
                    .from("tenant_passports")
                    .update({
                      identity_verified: true,
                      credit_score: screenData.credit_score,
                      income_verified: null,
                      eviction_history: screenData.evictions,
                      criminal_records: screenData.criminal_record,
                      right_to_rent: null,
                      screening_provider: process.env.RENTPREP_API_KEY ? "rentprep" : process.env.CHECKR_API_KEY ? "checkr" : "mock",
                      last_screening_id: screeningId,
                      passport_expiry_date: expiry.toISOString(),
                      updated_at: now.toISOString()
                    })
                    .eq("id", (existingPassport as { id: string }).id);
                } else {
                  await supabaseServer.from("tenant_passports").insert({
                    tenant_id: tenant.id,
                    identity_verified: true,
                    credit_score: screenData.credit_score,
                    income_verified: null,
                    eviction_history: screenData.evictions,
                    criminal_records: screenData.criminal_record,
                    right_to_rent: null,
                    screening_provider: process.env.RENTPREP_API_KEY ? "rentprep" : process.env.CHECKR_API_KEY ? "checkr" : "mock",
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
