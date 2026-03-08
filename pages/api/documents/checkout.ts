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

  const documentText = String(body.documentText ?? "").trim();
  const documentType = String(body.documentType ?? "").trim();
  if (!documentText || !documentType) {
    return json({ error: "Missing documentText or documentType." }, 400);
  }

  const isLease =
    documentType === "ast_lease" ||
    documentType === "rent_increase" ||
    documentType === "lease";
  const amountPence = isLease ? 1500 : 1000; // £15 lease / £10 eviction

  const adminClient = getAdminClient();
  const { data: row, error: insertError } = await adminClient
    .from("document_download_tokens")
    .insert({ document_text: documentText, document_type: documentType })
    .select("token")
    .single();

  if (insertError || !row?.token) {
    console.error("document_download_tokens insert:", insertError);
    return json({ error: "Could not create download." }, 500);
  }

  const origin =
    (req.headers.get("origin") || req.headers.get("referer") || "").replace(/\/$/, "") ||
    "https://rentlease.app";
  const token = row.token as string;
  const successUrl = `${origin}/documents?paid=1&token=${encodeURIComponent(token)}`;
  const cancelUrl = `${origin}/documents?token=${encodeURIComponent(token)}`;

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      mode: "payment",
      "payment_method_types[]": "card",
      "line_items[0][price_data][currency]": "gbp",
      "line_items[0][price_data][unit_amount]": String(amountPence),
      "line_items[0][price_data][product_data][name]": isLease
        ? "Lease download"
        : "Eviction notice download",
      "line_items[0][price_data][product_data][description]":
        "One-time PDF download of your generated document.",
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: token,
      "metadata[document_token]": token,
    }).toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.text();
    console.error("Stripe error:", stripeRes.status, err);
    return json({ error: "Payment setup failed. Please try again." }, 502);
  }

  const session = (await stripeRes.json()) as { id: string; url: string };

  await adminClient
    .from("document_download_tokens")
    .update({ stripe_session_id: session.id })
    .eq("token", token);

  return json({ url: session.url });
}
