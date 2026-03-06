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
  const token = (url.searchParams.get("token") ?? "").trim();
  if (!token) return json({ valid: false, error: "Missing token" }, 400);

  const supabase = getAdminClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select(`
      id,
      file_url,
      signing_token_expires_at,
      signed_at,
      tenant_email,
      document_content,
      applications (
        tenants ( first_name, last_name ),
        properties ( address, city, state, zip )
      )
    `)
    .eq("signing_token", token)
    .maybeSingle();

  if (error || !doc) {
    return json({
      valid: false,
      expired: false,
      alreadySigned: false,
      tenantName: "",
      propertyAddress: "",
      leaseContent: "",
      leasePdfUrl: ""
    });
  }

  const d = doc as {
    id: string;
    file_url: string;
    signing_token_expires_at: string | null;
    signed_at: string | null;
    tenant_email: string | null;
    document_content: string | null;
    applications: {
      tenants: { first_name: string; last_name: string } | null;
      properties: { address: string; city: string; state: string; zip: string } | null;
    } | null;
  };

  const now = new Date().toISOString();
  const expired = d.signing_token_expires_at ? d.signing_token_expires_at < now : true;
  const alreadySigned = !!d.signed_at;

  const tenant = d.applications?.tenants;
  const property = d.applications?.properties;
  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "";
  const propertyAddress = property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "";

  return json({
    valid: !expired && !alreadySigned,
    expired,
    alreadySigned,
    signedAt: d.signed_at ?? null,
    tenantName,
    propertyAddress,
    leaseContent: (d.document_content ?? "").trim(),
    leasePdfUrl: d.file_url ?? ""
  });
}
