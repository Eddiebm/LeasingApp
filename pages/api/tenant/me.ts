import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const applicationId = (req.query.applicationId as string)?.trim();
  const email = (req.query.email as string)?.trim()?.toLowerCase();
  if (!applicationId || !email) return res.status(400).json({ error: "applicationId and email required" });

  const { data: app, error: appError } = await supabaseServer
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

  if (appError || !app) return res.status(404).json({ error: "Application not found" });
  const a = app as {
    id: string;
    status: string;
    lease_signed_at: string | null;
    lease_signed_pdf_url: string | null;
    tenants: { id: string; first_name: string; last_name: string; email: string } | null;
    properties: { address: string; city: string; state: string; zip: string; rent: number } | null;
  };
  const tenantEmail = a.tenants?.email?.toLowerCase();
  if (tenantEmail !== email) return res.status(403).json({ error: "Access denied" });

  const [docsRes, maintenanceRes, paymentsRes] = await Promise.all([
    supabaseServer.from("documents").select("type, file_url, created_at").eq("application_id", a.id).order("created_at", { ascending: false }),
    supabaseServer.from("maintenance_requests").select("id, category, description, status, created_at").eq("application_id", a.id).order("created_at", { ascending: false }),
    supabaseServer.from("payments").select("id, amount_cents, status, paid_at, created_at").eq("application_id", a.id).order("created_at", { ascending: false })
  ]);

  return res.status(200).json({
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
