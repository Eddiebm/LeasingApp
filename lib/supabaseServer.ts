import { createClient, SupabaseClient } from "@supabase/supabase-js";

// On Cloudflare Workers, env vars are injected per-request via the env binding,
// not at module load time. Always call getSupabaseServer() inside request handlers,
// never at module level, so env vars are resolved at request time.
export function getSupabaseServer(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://placeholder.supabase.co";

  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "placeholder";

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
