import { createClient, User } from "@supabase/supabase-js";

export type AuthResult = { user: User; email: string } | null;

export async function getDashboardUser(req: { headers: { authorization?: string } }): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  // Use service role key for server-side token validation — available at runtime on Cloudflare edge
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) return null;

  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user?.email) return null;

  const staffList = process.env.DASHBOARD_STAFF_EMAILS;
  if (staffList) {
    const allowed = staffList.split(",").map((e) => e.trim().toLowerCase());
    if (!allowed.includes(user.email.toLowerCase())) return null;
  }

  return { user, email: user.email };
}
