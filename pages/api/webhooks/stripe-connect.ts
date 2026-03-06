import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { sendConnectOnboardingCompleteEmail } from "../../../lib/email";

export const runtime = "edge";

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

async function verifyStripeWebhook(payload: string, signature: string, secret: string): Promise<boolean> {
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
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === parsed.v1;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const env = getEnv();
  const webhookSecret = env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) return json({ error: "Connect webhook not configured" }, 503);

  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";
  if (!sigHeader) return json({ error: "Missing signature" }, 400);

  const ok = await verifyStripeWebhook(rawBody, sigHeader, webhookSecret);
  if (!ok) {
    console.error("Stripe Connect webhook signature verification failed");
    return json({ error: "Invalid signature" }, 400);
  }

  let event: { type: string; data?: { object?: { id?: string; charges_enabled?: boolean; payouts_enabled?: boolean } } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (event.type !== "account.updated") return json({ received: true });

  const account = event.data?.object;
  if (!account?.id) return json({ received: true });

  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;
  const onboarded = chargesEnabled && payoutsEnabled;

  const db = getAdminClient();
  const { data: landlord } = await db
    .from("landlords")
    .select("id, email, full_name")
    .eq("stripe_connect_account_id", account.id)
    .maybeSingle();

  if (!landlord) return json({ received: true });

  await db
    .from("landlords")
    .update({
      stripe_connect_onboarded: onboarded,
      stripe_connect_charges_enabled: chargesEnabled,
      stripe_connect_payouts_enabled: payoutsEnabled
    })
    .eq("id", (landlord as { id: string }).id);

  if (onboarded) {
    sendConnectOnboardingCompleteEmail(
      (landlord as { email: string }).email,
      (landlord as { full_name: string }).full_name ?? "Landlord",
      { resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>" }
    ).catch(console.error);
  }

  return json({ received: true });
}
