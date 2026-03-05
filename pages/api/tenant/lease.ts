import type { NextApiRequest, NextApiResponse } from "next";
import { getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

/**
 * GET /api/tenant/lease?applicationId=&email=
 * Returns lease info for sign-lease page after verifying email.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const applicationId = (req.query.applicationId as string)?.trim();
  const email = (req.query.email as string)?.trim()?.toLowerCase();
  if (!applicationId || !email) return res.status(400).json({ error: "applicationId and email required" });

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

  if (error || !app) return res.status(404).json({ error: "Application not found" });
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
  if (tenantEmail !== email) return res.status(403).json({ error: "Access denied" });

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

  return res.status(200).json({
    applicationId: a.id,
    tenantName,
    propertyAddress,
    rent,
    leasePdfUrl,
    signed: !!a.lease_signed_at,
    signedAt: a.lease_signed_at,
    signedPdfUrl: a.lease_signed_pdf_url,
    signature: a.signature
  });
}
