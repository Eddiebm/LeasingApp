import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SCREENING_FEE_CENTS = Math.max(50, Math.round(Number(process.env.SCREENING_FEE_CENTS) || 3500)); // default $35

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const env = getEnv();
  const stripeKey = (env as Record<string, string>).STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { applicationId } = body ?? {};
  if (!applicationId || typeof applicationId !== "string") {
    return json({ error: "applicationId required" }, 400);
  }

  const supabase = getAdminClient();

  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return json({ error: "Application not found" }, 404);

  const { data: existing } = await supabase
    .from("payments")
    .select("id, status")
    .eq("application_id", applicationId)
    .eq("payment_type", "screening_fee")
    .maybeSingle();

  if (existing && existing.status === "paid") {
    return json({ error: "Screening fee already paid for this application" }, 400);
  }

  if (!stripeKey) return json({ error: "Payments not configured" }, 503);

  const { data: paymentRow, error: payError } = await supabase
    .from("payments")
    .insert({
      application_id: applicationId,
      amount_cents: SCREENING_FEE_CENTS,
      status: "pending",
      payment_type: "screening_fee",
    })
    .select("id")
    .single();

  if (payError || !paymentRow) {
    console.error(payError);
    return json({ error: "Failed to create payment record" }, 500);
  }

  const piRes = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: String(SCREENING_FEE_CENTS),
      currency: "usd",
      "metadata[applicationId]": applicationId,
      "metadata[paymentId]": (paymentRow as { id: string }).id,
      "metadata[payment_type]": "screening_fee",
    }).toString(),
  });

  if (!piRes.ok) {
    console.error("Stripe PI error:", await piRes.text());
    return json({ error: "Failed to create payment intent" }, 502);
  }

  const paymentIntent = (await piRes.json()) as { id: string; client_secret: string };

  await supabase
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", (paymentRow as { id: string }).id);

  return json({
    clientSecret: paymentIntent.client_secret,
    amountCents: SCREENING_FEE_CENTS,
  });
}
