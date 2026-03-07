import { getSupabaseServer } from "../../../lib/supabaseServer";
export const runtime = "edge";

/**
 * POST /api/webhooks/stripe-identity
 * Handles Stripe Identity webhook events.
 * When identity.verification_session.verified fires, marks the landlord as identity_verified.
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const body = await req.text();
  let event: Record<string, unknown>;

  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = event.type as string;
  const eventObject = event.data as Record<string, unknown>;
  const session = eventObject?.object as Record<string, unknown>;

  if (eventType === "identity.verification_session.verified") {
    const landlordId = (session?.metadata as Record<string, string>)?.landlord_id;

    if (landlordId) {
      await getSupabaseServer()
        .from("landlords")
        .update({
          identity_verified: true,
          identity_verified_at: new Date().toISOString(),
        })
        .eq("id", landlordId);
    }
  }

  if (eventType === "identity.verification_session.requires_input") {
    // Verification failed or needs more info — don't mark as verified
    const landlordId = (session?.metadata as Record<string, string>)?.landlord_id;
    if (landlordId) {
      await getSupabaseServer()
        .from("landlords")
        .update({ identity_verified: false })
        .eq("id", landlordId);
    }
  }

  return new Response("ok", { status: 200 });
}
