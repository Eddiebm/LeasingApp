import { supabase } from "../../../lib/supabaseClient";
import { getDashboardUser } from "../../../lib/apiAuth";

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
    const auth = await getDashboardUser(req as unknown as { headers: { authorization?: string } });
    if (!auth) return json({ error: "Unauthorized" }, 401);
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
