import { supabase } from "../../../lib/supabaseClient";
import { getDashboardUser } from "../../../lib/apiAuth";

export const runtime = "edge";

const STATUSES = ["submitted", "in_progress", "resolved"] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() ?? "";
  if (!id) return json({ error: "Missing request id" }, 400);

  if (req.method === "PATCH") {
    const auth = await getDashboardUser(req as unknown as { headers: { authorization?: string } });
    if (!auth) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const { status } = body;
    if (!status || !STATUSES.includes(status as typeof STATUSES[number])) {
      return json({ error: "Invalid status. Use submitted, in_progress, or resolved." }, 400);
    }

    const { error } = await supabase
      .from("maintenance_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    return json({ success: true });
  }

  return new Response(null, { status: 405 });
}
