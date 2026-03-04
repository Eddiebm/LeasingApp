import type { NextApiRequest, NextApiResponse } from "next";
import { getDashboardUser } from "../../../../lib/apiAuth";
import { supabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const auth = await getDashboardUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing application id" });

  const { data: app, error: appError } = await supabaseServer
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

  if (appError || !app) return res.status(404).json({ error: "Application not found" });

  const { data: history } = await supabaseServer
    .from("application_status_history")
    .select("from_status, to_status, changed_at, changed_by")
    .eq("application_id", id)
    .order("changed_at", { ascending: true });

  const { data: docs } = await supabaseServer
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

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="application-${id}-export.json"`);
  return res.status(200).send(JSON.stringify(exportData, null, 2));
}
