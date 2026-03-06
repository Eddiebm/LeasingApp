import { getRequestContext } from "@cloudflare/next-on-pages";
import { getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim() ?? "";
  if (!token) return json({ error: "Missing token." }, 400);

  let env: Record<string, string> = {};
  try {
    env = getRequestContext().env as Record<string, string>;
  } catch {
    env = process.env as Record<string, string>;
  }

  const stripeKey = env.STRIPE_SECRET_KEY;

  const adminClient = getAdminClient();
  const { data: row, error: fetchError } = await adminClient
    .from("lease_download_tokens")
    .select("lease_text, form_json, stripe_session_id")
    .eq("token", token)
    .single();

  if (fetchError || !row) return json({ error: "Lease not found or expired." }, 404);

  const sessionId = row.stripe_session_id as string | null;
  if (!sessionId) return json({ error: "Payment required to download." }, 403);

  // Verify payment with Stripe if key is available
  if (stripeKey) {
    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: { Authorization: `Bearer ${stripeKey}` },
      }
    );
    if (stripeRes.ok) {
      const session = (await stripeRes.json()) as { payment_status?: string };
      if (session.payment_status !== "paid") {
        return json({ error: "Payment not completed." }, 403);
      }
    }
  }

  return json({
    leaseText: row.lease_text,
    formData: row.form_json ?? {},
  });
}
