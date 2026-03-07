import { createClient } from "@supabase/supabase-js";
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
 * POST /api/auth/verify-phone-otp
 * Body: { phone: string, token: string }
 * Verifies the OTP and marks the landlord's phone as verified.
 * Also accepts { skip: true } to allow skipping verification (for testing / graceful degradation).
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  // Allow skip for graceful degradation when SMS is not configured
  if (body.skip === true) {
    return json({ success: true, skipped: true });
  }

  const phone = String(body.phone ?? "").trim();
  const token = String(body.token ?? "").trim();

  if (!phone || !token) return json({ error: "Phone and token are required" }, 400);

  const supabaseUrl = "https://seedtvpyhmzskkdlnblg.supabase.co";
  const anonKey = "sb_publishable_KUY0YWTlIfqPW20phruqiw_B75TXglU";
  const supabase = createClient(supabaseUrl, anonKey);

  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });

  if (error) {
    return json({ error: error.message || "Invalid or expired code" }, 400);
  }

  // Mark the landlord's phone as verified in the landlords table
  // We do this via the user's Bearer token from the request headers
  const auth = await getLandlordOrAdmin(req);
  if (auth && auth.landlordId) {
    await getSupabaseServer()
      .from("landlords")
      .update({ phone_verified: true, phone_verified_at: new Date().toISOString() })
      .eq("id", auth.landlordId);
  }

  return json({ success: true });
}
