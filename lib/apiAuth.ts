import { createClient } from "@supabase/supabase-js";

export type AuthResult = { user: { id: string; email: string }; email: string } | null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://seedtvpyhmzskkdlnblg.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
  "sb_publishable_KUY0YWTlIfqPW20phruqiw_B75TXglU";

/**
 * Extracts the Bearer token from a request, supporting both:
 * - Web Request API (edge runtime): req.headers.get("authorization")
 * - Old-style NextApiRequest: req.headers.authorization
 */
function extractToken(req: Request | { headers: { authorization?: string } }): string | null {
  let authHeader: string | null | undefined;
  if (typeof (req.headers as Headers).get === "function") {
    // Web Request API (edge runtime)
    authHeader = (req.headers as Headers).get("authorization");
  } else {
    // Old-style NextApiRequest
    authHeader = (req.headers as { authorization?: string }).authorization;
  }
  if (!authHeader) return null;
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

export async function getDashboardUser(req: Request | { headers: { authorization?: string } }): Promise<AuthResult> {
  const token = extractToken(req);
  if (!token) return null;

  // Create a Supabase client scoped to the user's token
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user?.email || !user?.id) return null;

  const staffList = process.env.DASHBOARD_STAFF_EMAILS;
  if (staffList) {
    const allowed = staffList.split(",").map((e) => e.trim().toLowerCase());
    if (!allowed.includes(user.email.toLowerCase())) return null;
  }

  return { user: { id: user.id, email: user.email }, email: user.email };
}

export function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
