import { getAdminClient } from "../../../../lib/apiAuth";
import { getEnv } from "../../../../lib/cloudflareEnv";

export const runtime = "edge";

const PLATFORM_FEE_ACH_CENTS = 200;
const PLATFORM_FEE_CARD_PERCENT = 3.5;

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
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const paymentId = getPaymentId(req).trim();
  if (!paymentId) return json({ error: "Payment ID required" }, 400);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const paymentMethod = (body.paymentMethod as string) === "ach" ? "ach" : "card";

  const admin = getAdminClient();
  const { data: payment, error } = await admin
    .from("rent_payments")
    .select("id, amount_cents, late_fee_cents, currency, status, landlord_id, rent_schedule_id")
    .eq("id", paymentId)
    .maybeSingle();

  if (error || !payment) return json({ error: "Payment not found" }, 404);

  const p = payment as { id: string; amount_cents: number; late_fee_cents: number; currency: string; status: string; landlord_id: string };
  if (p.status !== "pending") return json({ error: "Payment is not pending" }, 400);

  const totalCents = p.amount_cents + (p.late_fee_cents ?? 0);
  const platformFeeCents =
    paymentMethod === "ach" ? PLATFORM_FEE_ACH_CENTS : Math.round(totalCents * (PLATFORM_FEE_CARD_PERCENT / 100));
  const amountToCharge = totalCents + platformFeeCents;

  const { data: landlordRow } = await admin.from("landlords").select("stripe_connect_account_id").eq("id", p.landlord_id).single();
  const connectAccountId = (landlordRow as { stripe_connect_account_id: string } | null)?.stripe_connect_account_id;
  if (!connectAccountId) return json({ error: "Landlord Connect not configured" }, 503);

  const env = getEnv();
  const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Stripe not configured" }, 503);

  const paymentMethodTypes = paymentMethod === "ach" ? ["us_bank_account"] : ["card"];

  const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      amount: String(amountToCharge),
      currency: (p.currency || "usd").toLowerCase(),
      "payment_method_types[]": paymentMethodTypes,
      "application_fee_amount": String(platformFeeCents),
      "transfer_data[destination]": connectAccountId,
      "metadata[rentPaymentId]": paymentId,
      "metadata[rentScheduleId]": p.rent_schedule_id ?? ""
    }).toString()
  });

  if (!piRes.ok) {
    const err = await piRes.text();
    console.error("Stripe PI error:", err);
    return json({ error: "Failed to create payment intent" }, 502);
  }

  const pi = (await piRes.json()) as { id: string; client_secret: string };
  await admin
    .from("rent_payments")
    .update({
      stripe_payment_intent_id: pi.id,
      platform_fee_cents: platformFeeCents,
      payment_method: paymentMethod,
      status: "processing"
    })
    .eq("id", paymentId);

  return json({ clientSecret: pi.client_secret, paymentIntentId: pi.id });
}
