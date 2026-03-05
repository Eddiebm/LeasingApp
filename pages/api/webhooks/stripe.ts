import { getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

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

  let event: { type: string; data?: { object?: { metadata?: { paymentId?: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentId = event.data?.object?.metadata?.paymentId;
    if (paymentId) {
      await getAdminClient()
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);
    }
  }

  return json({ received: true });
}
