export type AuthResult = { user: { id: string; email: string }; email: string } | null;

export async function getDashboardUser(req: { headers: { authorization?: string } }): Promise<AuthResult> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://seedtvpyhmzskkdlnblg.supabase.co";

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  if (!supabaseUrl || !supabaseServiceKey) return null;

  // Use direct fetch instead of Supabase JS client to avoid edge runtime issues.
  // The sb_secret key works as both apikey and Bearer token for the admin endpoint.
  const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      "apikey": supabaseServiceKey,
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!resp.ok) return null;

  const user = await resp.json() as { id?: string; email?: string };
  if (!user?.email || !user?.id) return null;

  const staffList = process.env.DASHBOARD_STAFF_EMAILS;
  if (staffList) {
    const allowed = staffList.split(",").map((e) => e.trim().toLowerCase());
    if (!allowed.includes(user.email.toLowerCase())) return null;
  }

  return { user: { id: user.id!, email: user.email! }, email: user.email! };
}
