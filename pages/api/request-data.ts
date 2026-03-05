import { getSupabaseServer } from "../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return json({ error: "Email required." }, 400);

  const { data: tenant } = await getSupabaseServer()
    .from("tenants")
    .select("id, first_name, last_name, email, phone, dob, created_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!tenant) {
    return json({ message: "If an account exists for this email, we will process your request." });
  }

  const { data: applications } = await getSupabaseServer()
    .from("applications")
    .select("id, status, created_at")
    .eq("tenant_id", (tenant as { id: string }).id);

  const { data: documents } = await getSupabaseServer()
    .from("documents")
    .select("type, file_url, created_at")
    .in("application_id", (applications ?? []).map((a: { id: string }) => a.id));

  const t = tenant as { id: string; first_name: string; last_name: string; email: string; phone: string; dob: string; created_at: string };
  return json({
    message: "Request received.",
    tenant: { id: t.id, firstName: t.first_name, lastName: t.last_name, email: t.email, phone: t.phone, dob: t.dob, createdAt: t.created_at },
    applications: applications ?? [],
    documents: documents ?? []
  });
}
