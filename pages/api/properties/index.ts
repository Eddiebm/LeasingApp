import { supabase } from "../../../lib/supabaseClient";
import { supabaseServer } from "../../../lib/supabaseServer";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const forDashboard = url.searchParams.get("for") === "dashboard";
  if (forDashboard) {
    const auth = await getLandlordOrAdmin(req);
    if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);
    const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabaseDashboard = createSupabaseForUser(token);
    const { data, error } = await supabaseDashboard
      .from("properties")
      .select("id, address, city, state, zip, rent, status, application_deadline")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    return json(data ?? []);
  }

  const landlordSlug = url.searchParams.get("slug") ?? undefined;
  if (landlordSlug) {
    const { data: landlord, error: landlordError } = await supabaseServer
      .from("landlords")
      .select("id")
      .eq("slug", landlordSlug)
      .maybeSingle();
    if (landlordError) {
      console.error(landlordError);
      return json({ error: landlordError.message }, 500);
    }
    if (!landlord) return json({ error: "Landlord not found" }, 404);
    const { data, error } = await supabaseServer
      .from("properties")
      .select("id, address, city, state, zip, rent, status, application_deadline")
      .eq("status", "active")
      .eq("landlord_id", landlord.id)
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    return json(data ?? []);
  }

  const { data, error } = await supabase
    .from("properties")
    .select("id, address, city, state, zip, rent, status, application_deadline")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }
  return json(data ?? []);
}
