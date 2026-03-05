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
  const applicationId = url.searchParams.get("applicationId")?.trim() ?? "";
  const email = url.searchParams.get("email")?.trim()?.toLowerCase() ?? "";
  if (!applicationId || !email) return json({ error: "applicationId and email required" }, 400);

  const { data: app, error: appError } = await getAdminClient()
    .from("applications")
    .select(`
      id,
      status,
      lease_signed_at,
      lease_signed_pdf_url,
      tenants ( id, first_name, last_name, email ),
      properties ( address, city, state, zip, rent )
    `)
    .eq("id", applicationId)
    .single();

  if (appError || !app) return json({ error: "Application not found" }, 404);
  const a = app as {
    id: string;
    status: string;
    lease_signed_at: string | null;
    lease_signed_pdf_url: string | null;
    tenants: { id: string; first_name: string; last_name: string; email: string } | null;
    properties: { address: string; city: string; state: string; zip: string; rent: number } | null;
  };
  const tenantEmail = a.tenants?.email?.toLowerCase();
  if (tenantEmail !== email) return json({ error: "Access denied" }, 403);

  const [docsRes, maintenanceRes, paymentsRes] = await Promise.all([
    getAdminClient().from("documents").select("type, file_url, created_at").eq("application_id", a.id).order("created_at", { ascending: false }),
    getAdminClient().from("maintenance_requests").select("id, category, description, status, created_at").eq("application_id", a.id).order("created_at", { ascending: false }),
    getAdminClient().from("payments").select("id, amount_cents, status, paid_at, created_at").eq("application_id", a.id).order("created_at", { ascending: false })
  ]);

  return json({
    applicationId: a.id,
    status: a.status,
    tenantName: a.tenants ? `${a.tenants.first_name} ${a.tenants.last_name}`.trim() : "",
    propertyAddress: a.properties ? `${a.properties.address}, ${a.properties.city}, ${a.properties.state} ${a.properties.zip}` : "",
    rent: a.properties?.rent ?? null,
    leaseSignedAt: a.lease_signed_at,
    signedLeasePdfUrl: a.lease_signed_pdf_url,
    documents: (docsRes.data ?? []).map((d: { type: string; file_url: string; created_at: string }) => ({ type: d.type, fileUrl: d.file_url, createdAt: d.created_at })),
    maintenance: (maintenanceRes.data ?? []).map((m: { id: string; category: string; description: string; status: string; created_at: string }) => ({
      id: m.id,
      category: m.category,
      description: m.description,
      status: m.status,
      createdAt: m.created_at
    })),
    payments: (paymentsRes.data ?? []).map((p: { id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string }) => ({
      id: p.id,
      amountCents: p.amount_cents,
      status: p.status,
      paidAt: p.paid_at,
      createdAt: p.created_at
    }))
  });
}
