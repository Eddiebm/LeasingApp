import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const env = getEnv();
  const stripeKey = (env as Record<string, string>).STRIPE_SECRET_KEY ?? process.env.STRIPE_SECRET_KEY;

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { applicationId, amountCents } = body;
  if (!applicationId || typeof amountCents !== "number" || (amountCents as number) < 50) {
    return json({ error: "applicationId and amountCents (min 50) required" }, 400);
  }

  const supabase = getAdminClient();
  const { data: app } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return json({ error: "Application not found" }, 404);
  if (!stripeKey) return json({ error: "Payments not configured" }, 503);

  const { data: paymentRow, error: payError } = await supabase
    .from("payments")
    .insert({
      application_id: applicationId,
      amount_cents: amountCents,
      status: "pending",
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
      amount: String(amountCents),
      currency: "usd",
      "metadata[applicationId]": String(applicationId),
      "metadata[paymentId]": (paymentRow as { id: string }).id,
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

  return json({ clientSecret: paymentIntent.client_secret });
}
