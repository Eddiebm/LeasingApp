import { createClient } from "@supabase/supabase-js";
export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/auth/send-phone-otp
 * Body: { phone: string }
 * Sends a 6-digit OTP to the given phone number via Supabase Auth.
 * The phone must be in E.164 format e.g. +14155552671 or +447911123456
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const phone = String(body.phone ?? "").trim();
  if (!phone) return json({ error: "Phone number is required" }, 400);

  // Basic E.164 validation
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return json({ error: "Phone must be in international format, e.g. +14155552671" }, 400);
  }

  const supabaseUrl = "https://seedtvpyhmzskkdlnblg.supabase.co";
  const anonKey = "sb_publishable_KUY0YWTlIfqPW20phruqiw_B75TXglU";

  const supabase = createClient(supabaseUrl, anonKey);

  const { error } = await supabase.auth.signInWithOtp({ phone });

  if (error) {
    // If Supabase phone auth is not enabled, fall back gracefully
    if (error.message?.includes("not enabled") || error.message?.includes("Phone provider")) {
      return json({ error: "SMS verification is not configured. Please contact support." }, 503);
    }
    return json({ error: error.message }, 400);
  }

  return json({ success: true, message: "OTP sent" });
}
