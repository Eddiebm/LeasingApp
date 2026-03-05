import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Creates a Supabase client that uses the user's JWT.
 * All queries run with RLS applied for that user (landlord sees only their data, admin sees all).
 */
export function createSupabaseForUser(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
