import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getRequestContext } from "@cloudflare/next-on-pages";

// On Cloudflare Workers, env vars are injected per-request via the env binding,
// not at module load time. Always call getSupabaseServer() inside request handlers,
// never at module level, so env vars are resolved at request time.
export function getSupabaseServer(): SupabaseClient {
  // Use getRequestContext to access Cloudflare env vars that Next.js strips at build time
  let cfEnv: Record<string, string> = {};
  try { cfEnv = getRequestContext().env as Record<string, string>; } catch { /* not in CF runtime */ }

  // Use || not ?? so empty string env vars (Cloudflare Pages behavior) fall back correctly
  const supabaseUrl =
    cfEnv.NEXT_PUBLIC_SUPABASE_URL ||
    cfEnv.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    // Hardcoded fallback: Cloudflare Pages process.env is empty at edge runtime
    "https://seedtvpyhmzskkdlnblg.supabase.co";

  const supabaseServiceKey =
    cfEnv.SUPABASE_SERVICE_ROLE_KEY ||
    cfEnv.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    // Hardcoded fallback: Cloudflare Pages env var PATCH does not persist reliably
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZWR0dnB5aG16c2trZGxuYmxnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjY2MDA3NiwiZXhwIjoyMDg4MjM2MDc2fQ.RbroCKolt6mJOwqNSJOQXKcpIAaLeH5eTvbYsIayFZg";

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
