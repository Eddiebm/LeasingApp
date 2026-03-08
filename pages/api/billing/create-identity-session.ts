import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { getSupabaseServer } from "../../../lib/supabaseServer";
export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/billing/create-identity-session
 * Creates a Stripe Identity verification session for the landlord.
 * Returns a client_secret to use with Stripe.js to launch the verification flow.
 * Cost: $1.50 per completed verification.
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const stripeKey = (typeof process !== "undefined" && process.env?.STRIPE_SECRET_KEY) || "";
  if (!stripeKey) {
    return json({ error: "Stripe is not configured" }, 503);
  }

  const landlordId = auth.landlordId;
  const landlordEmail = auth.email;

  // Create Stripe Identity verification session via REST API
  const params = new URLSearchParams({
    type: "document",
    "metadata[landlord_id]": landlordId ?? "",
    "metadata[email]": landlordEmail ?? "",
    "options[document][require_matching_selfie]": "true",
    "return_url": "https://rentlease.app/dashboard/billing?verified=1",
  });

  const res = await fetch("https://api.stripe.com/v1/identity/verification_sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const session = await res.json();

  if (!res.ok || session.error) {
    console.error("Stripe Identity error:", session.error);
    return json({ error: session.error?.message ?? "Failed to create verification session" }, 502);
  }

  // Store the session ID on the landlord record
  if (landlordId) {
    await getSupabaseServer()
      .from("landlords")
      .update({ stripe_identity_session_id: session.id })
      .eq("id", landlordId);
  }

  return json({
    sessionId: session.id,
    url: session.url, // Redirect URL for hosted verification
    clientSecret: session.client_secret,
  });
}
