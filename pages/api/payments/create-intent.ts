import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import Stripe from "stripe";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const env = getEnv();
  const stripeKey = (env as Record<string, string>).STRIPE_SECRET_KEY;
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2024-06-20" }) : null;
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

  if (!stripe) return json({ error: "Payments not configured" }, 503);

  const { data: paymentRow, error: payError } = await supabase
    .from("payments")
    .insert({
      application_id: applicationId,
      amount_cents: amountCents,
      status: "pending"
    })
    .select("id")
    .single();

  if (payError || !paymentRow) {
    console.error(payError);
    return json({ error: "Failed to create payment record" }, 500);
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents as number,
    currency: "usd",
    metadata: { applicationId: applicationId as string, paymentId: (paymentRow as { id: string }).id }
  });

  await supabase
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", (paymentRow as { id: string }).id);

  return json({ clientSecret: paymentIntent.client_secret });
}
