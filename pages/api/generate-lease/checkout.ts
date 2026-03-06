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
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let env: Record<string, string> = {};
  try {
    env = getRequestContext().env as Record<string, string>;
  } catch {
    env = process.env as Record<string, string>;
  }

  const stripeKey = env.STRIPE_SECRET_KEY;
  if (!stripeKey) return json({ error: "Payments not configured." }, 503);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) return json({ error: "Missing token." }, 400);

  const adminClient = getAdminClient();
  const { data: row, error: fetchError } = await adminClient
    .from("lease_download_tokens")
    .select("id, form_json")
    .eq("token", token)
    .single();

  if (fetchError || !row) return json({ error: "Lease not found or expired." }, 404);

  const formJson = (row.form_json ?? {}) as Record<string, unknown>;
  const country = String(formJson.country ?? "").trim();
  const isUK = country === "UK";
  const currency = isUK ? "gbp" : "usd";
  const unitAmount = isUK ? 1500 : 1800; // £15 / $18

  const origin =
    (req.headers.get("origin") || req.headers.get("referer") || "").replace(/\/$/, "") ||
    "https://leasingapp.pages.dev";
  const successUrl = `${origin}/generate-lease?paid=1&token=${encodeURIComponent(token)}`;
  const cancelUrl = `${origin}/generate-lease?token=${encodeURIComponent(token)}`;

  // Create Stripe checkout session via API (no SDK needed)
  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": currency,
      "line_items[0][price_data][unit_amount]": String(unitAmount),
      "line_items[0][price_data][product_data][name]": "Full lease download",
      "line_items[0][price_data][product_data][description]":
        "One-time download of your generated tenancy agreement (PDF).",
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: token,
      "metadata[lease_token]": token,
    }).toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Stripe error:", stripeRes.status, err);
    return json({ error: "Payment setup failed. Please try again." }, 502);
  }

  const session = (await stripeRes.json()) as { id: string; url: string };

  await adminClient
    .from("lease_download_tokens")
    .update({ stripe_session_id: session.id })
    .eq("token", token);

  return json({ url: session.url });
}
