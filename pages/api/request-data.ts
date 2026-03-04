import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const email = req.body?.email?.trim?.();
  if (!email) return res.status(400).json({ error: "Email required." });

  const { data: tenant } = await supabaseServer
    .from("tenants")
    .select("id, first_name, last_name, email, phone, dob, created_at")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (!tenant) {
    return res.status(200).json({ message: "If an account exists for this email, we will process your request." });
  }

  const { data: applications } = await supabaseServer
    .from("applications")
    .select("id, status, created_at")
    .eq("tenant_id", tenant.id);

  const { data: documents } = await supabaseServer
    .from("documents")
    .select("type, file_url, created_at")
    .in("application_id", (applications ?? []).map((a: { id: string }) => a.id));

  return res.status(200).json({
    message: "Request received.",
    tenant: { id: tenant.id, firstName: tenant.first_name, lastName: tenant.last_name, email: tenant.email, phone: tenant.phone, dob: tenant.dob, createdAt: tenant.created_at },
    applications: applications ?? [],
    documents: documents ?? []
  });
}
