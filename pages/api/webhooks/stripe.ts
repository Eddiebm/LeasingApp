import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getRawBodyEdge(req: NextApiRequest): Promise<string> {
  const r = req as unknown as { text?: () => Promise<string>; body?: ReadableStream };
  if (typeof r.text === "function") return r.text();
  if (r.body && typeof (r.body as ReadableStream).getReader === "function") {
    const reader = (r.body as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const len = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) {
      out.set(c, off);
      off += c.length;
    }
    return new TextDecoder().decode(out);
  }
  return "";
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!webhookSecret) return res.status(503).json({ error: "Webhook not configured" });

  const rawBody = await getRawBodyEdge(req);
  const sigHeader = req.headers["stripe-signature"] as string;
  if (!sigHeader) return res.status(400).json({ error: "Missing signature" });

  const ok = await verifyStripeWebhook(rawBody, sigHeader, webhookSecret);
  if (!ok) {
    console.error("Stripe webhook signature verification failed");
    return res.status(400).json({ error: "Invalid signature" });
  }

  let event: { type: string; data?: { object?: { metadata?: { paymentId?: string } } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentId = event.data?.object?.metadata?.paymentId;
    if (paymentId) {
      await supabaseServer
        .from("payments")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", paymentId);
    }
  }

  return res.status(200).json({ received: true });
}
