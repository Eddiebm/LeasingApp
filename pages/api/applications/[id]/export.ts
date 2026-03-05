import { getDashboardUser } from "../../../../lib/apiAuth";
import { getSupabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const auth = await getDashboardUser(req as unknown as { headers: { authorization?: string } });
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 2] ?? "";
  if (!id) return json({ error: "Missing application id" }, 400);

  const { data: app, error: appError } = await getSupabaseServer()
    .from("applications")
    .select(`
      id,
      status,
      application_snapshot,
      credit_score,
      background_result,
      income,
      created_at,
      updated_at,
      lease_signed_at,
      lease_signed_pdf_url,
      tenants ( id, first_name, last_name, email, phone, dob, created_at ),
      properties ( id, address, city, state, zip, rent )
    `)
    .eq("id", id)
    .single();

  if (appError || !app) return json({ error: "Application not found" }, 404);

  const { data: history } = await getSupabaseServer()
    .from("application_status_history")
    .select("from_status, to_status, changed_at, changed_by")
    .eq("application_id", id)
    .order("changed_at", { ascending: true });

  const { data: docs } = await getSupabaseServer()
    .from("documents")
    .select("type, file_url, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: auth.email,
    application: app,
    statusHistory: history ?? [],
    documents: (docs ?? []).map((d: { type: string; file_url: string; created_at: string }) => ({
      type: d.type,
      fileUrl: d.file_url,
      createdAt: d.created_at
    }))
  };

  return new Response(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="application-${id}-export.json"`
    }
  });
}
