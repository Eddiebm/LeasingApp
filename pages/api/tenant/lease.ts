import { getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/tenant/lease?applicationId=&email=
 * Returns lease info for sign-lease page after verifying email.
 */
export default async function handler(req: Request) {
  const _url = new URL(req.url);
  if (req.method !== "GET") return new Response(null, { status: 405 });
  const applicationId = (_url.searchParams.get("applicationId") as string)?.trim();
  const email = (_url.searchParams.get("email") as string)?.trim()?.toLowerCase();
  if (!applicationId || !email) return json({ error: "applicationId and email required" }, 400);

  const supabase = getAdminClient();
  const { data: app, error } = await supabase
    .from("applications")
    .select(`
      id,
      status,
      lease_signed_at,
      lease_signed_pdf_url,
      signature,
      tenants ( first_name, last_name, email ),
      properties ( address, city, state, zip, rent )
    `)
    .eq("id", applicationId)
    .single();

  if (error || !app) return json({ error: "Application not found" }, 404);
  const a = app as {
    id: string;
    status: string;
    lease_signed_at: string | null;
    lease_signed_pdf_url: string | null;
    signature: string | null;
    tenants: { first_name: string; last_name: string; email: string } | null;
    properties: { address: string; city: string; state: string; zip: string; rent: number } | null;
  };
  const tenantEmail = a.tenants?.email?.toLowerCase();
  if (tenantEmail !== email) return json({ error: "Access denied" }, 403);

  const { data: doc } = await supabase
    .from("documents")
    .select("file_url")
    .eq("application_id", applicationId)
    .eq("type", "lease")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const leasePdfUrl = (doc as { file_url: string } | null)?.file_url ?? null;
  const tenantName = a.tenants ? `${a.tenants.first_name} ${a.tenants.last_name}`.trim() : "";
  const propertyAddress = a.properties
    ? `${a.properties.address}, ${a.properties.city}, ${a.properties.state} ${a.properties.zip}`
    : "";
  const rent = a.properties?.rent ?? null;

  return json({
    applicationId: a.id,
    tenantName,
    propertyAddress,
    rent,
    leasePdfUrl,
    signed: !!a.lease_signed_at,
    signedAt: a.lease_signed_at,
    signedPdfUrl: a.lease_signed_pdf_url,
    signature: a.signature
  }, 200);
}
