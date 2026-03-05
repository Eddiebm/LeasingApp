import Stripe from "stripe";
import { getSupabaseServer } from "../../../lib/getSupabaseServer()";

export const runtime = "edge";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" })
  : null;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { applicationId, amountCents } = body;
  if (!applicationId || typeof amountCents !== "number" || (amountCents as number) < 50) {
    return json({ error: "applicationId and amountCents (min 50) required" }, 400);
  }

  const { data: app } = await getSupabaseServer()
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .single();
  if (!app) return json({ error: "Application not found" }, 404);

  if (!stripe) return json({ error: "Payments not configured" }, 503);

  const { data: paymentRow, error: payError } = await getSupabaseServer()
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

  await getSupabaseServer()
    .from("payments")
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq("id", (paymentRow as { id: string }).id);

  return json({ clientSecret: paymentIntent.client_secret });
}
