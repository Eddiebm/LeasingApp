import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseServer } from "./supabaseServer";
import { getEnv } from "./cloudflareEnv";

export type LandlordRow = {
  id: string;
  user_id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  slug: string | null;
  country?: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
  stripe_connect_account_id?: string | null;
  stripe_connect_onboarded?: boolean | null;
  stripe_connect_charges_enabled?: boolean | null;
  stripe_connect_payouts_enabled?: boolean | null;
};

export type AuthResult =
  | { user: User; email: string; role: "admin" }
  | { user: User; email: string; role: "landlord"; landlordId: string; landlord: LandlordRow }
  | { user: User; email: string; role: null }
  | null;

/**
 * Resolves the dashboard user and their SaaS role/landlord.
 * - admin: platform admin (sees all).
 * - landlord: has a landlords row (sees only their data via RLS).
 * - role null: authenticated but no landlord row → should complete onboarding.
 * - null: not authenticated or tenant-only (no dashboard access).
 */
const ADMIN_USER_ID = "4c447225-b57c-4da1-83ff-94cc25ad6755";

export async function getLandlordOrAdmin(req: {
  headers: { authorization?: string } | { get?: (k: string) => string | null };
}): Promise<AuthResult> {
  // Support both NextApiRequest headers (plain object) and Web API Request.headers (Headers)
  const headers = req.headers as { authorization?: string; get?: (k: string) => string | null };
  const authHeader =
    typeof headers.get === "function"
      ? headers.get("authorization") ?? undefined
      : headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const env = getEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://seedtvpyhmzskkdlnblg.supabase.co";
  const supabaseAnon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ?? "sb_publishable_KUY0YWTlIfqPW20phruqiw_B75TXglU";
  if (!token || !supabaseUrl || !supabaseAnon) return null;

  const authClient = createClient(supabaseUrl, supabaseAnon);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);
  if (error || !user?.email) return null;

  // Hardcoded bootstrap admin bypass for Cloudflare runtime when service role key is unavailable.
  if (user.id === ADMIN_USER_ID) {
    return { user, email: user.email, role: "admin" };
  }

  const [{ data: roleRow }, { data: landlordRows }] = await Promise.all([
    getSupabaseServer().from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    getSupabaseServer().from("landlords").select("id, user_id, full_name, company_name, email, phone, slug, stripe_customer_id, subscription_status, subscription_current_period_end, country, stripe_connect_account_id, stripe_connect_onboarded, stripe_connect_charges_enabled, stripe_connect_payouts_enabled").eq("user_id", user.id).maybeSingle(),
  ]);

  const role = roleRow?.role;
  const landlord = landlordRows ?? null;

  if (role === "admin") return { user, email: user.email, role: "admin" };
  if (role === "landlord" && landlord) return { user, email: user.email, role: "landlord", landlordId: landlord.id, landlord };
  if (role === "tenant") return null;

  return { user, email: user.email, role: null };
}

/**
 * @deprecated Use getLandlordOrAdmin for SaaS. Kept for backward compatibility.
 * If DASHBOARD_STAFF_EMAILS is set, still allows those emails as legacy "staff" (no landlord row required).
 */
export async function getDashboardUser(req: {
  headers: { authorization?: string } | { get?: (k: string) => string | null };
}): Promise<{ user: User; email: string } | null> {
  const auth = await getLandlordOrAdmin(req);
  if (auth && (auth.role === "admin" || auth.role === "landlord")) return { user: auth.user, email: auth.email };
  return null;
}

/**
 * Supabase admin (service role) client. Call only inside request handlers.
 */
export function getAdminClient(): SupabaseClient {
  const env = getEnv();
  // Use || not ?? so empty string env vars also fall back to hardcoded values
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://seedtvpyhmzskkdlnblg.supabase.co";
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    // Hardcoded fallback: Cloudflare Pages env vars return empty string for unset vars
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZWR0dnB5aG16c2trZGxuYmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY2MDA3NiwiZXhwIjoyMDg4MjM2MDc2fQ.RbroCKolt6mJOwqNSJOQXKcpIAaLeH5eTvbYsIayFZg";
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
