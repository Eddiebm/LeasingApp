import { getAdminClient } from "../../../lib/apiAuth";

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
  const idParam = (url.searchParams.get("id") ?? "").trim();
  if (!idParam) return json({ error: "id (application ID or email) required" }, 400);

  const supabase = getAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);

  if (isUuid) {
    const { data: app, error } = await supabase
      .from("applications")
      .select("id, tenants ( first_name, last_name )")
      .eq("id", idParam)
      .maybeSingle();
    if (error || !app) return json({ error: "Application not found" }, 404);
    const a = app as { id: string; tenants: { first_name: string; last_name: string } | null };
    const tenantName = a.tenants ? `${a.tenants.first_name} ${a.tenants.last_name}`.trim() : "";
    return json({ applicationId: a.id, tenantName });
  }

  const email = idParam.toLowerCase();
  const { data: tenant, error: tenantErr } = await supabase
    .from("tenants")
    .select("id, first_name, last_name")
    .eq("email", email)
    .maybeSingle();
  if (tenantErr || !tenant) return json({ error: "No application found for this email" }, 404);
  const t = tenant as { id: string; first_name: string; last_name: string };
  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id")
    .eq("tenant_id", t.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (appErr || !app) return json({ error: "No application found for this email" }, 404);
  const a = app as { id: string };
  const tenantName = `${t.first_name} ${t.last_name}`.trim();
  return json({ applicationId: a.id, tenantName });
}
