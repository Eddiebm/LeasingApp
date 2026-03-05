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
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() ?? "";
  if (!id) return json({ error: "Missing application id" }, 400);

  if (req.method === "PATCH") {
    const auth = await getDashboardUser(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const { status, changedBy } = body;
    if (!status || !["approved", "rejected", "pending"].includes(status as string)) {
      return json({ error: "Invalid status" }, 400);
    }

    const { data: existing } = await supabase.from("applications").select("status").eq("id", id).single();
    const fromStatus = (existing as { status?: string } | null)?.status ?? null;

    const { error } = await supabase.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }

    await supabase.from("application_status_history").insert({
      application_id: id,
      from_status: fromStatus,
      to_status: status,
      changed_by: changedBy ?? auth.email
    });

    return json({ success: true });
  }

  return new Response(null, { status: 405 });
}
