import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "pest", "other"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const { getDashboardUser } = await import("../../../lib/apiAuth");
    const auth = await getDashboardUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : undefined;
    let q = supabase
      .from("maintenance_requests")
      .select(`
        id,
        category,
        description,
        photo_url,
        status,
        created_at,
        updated_at,
        applications (
          id,
          tenants ( first_name, last_name, email ),
          properties ( id, address, city, state, zip )
        )
      `)
      .order("created_at", { ascending: false });
    if (propertyId) {
      const { data: appIds } = await supabase.from("applications").select("id").eq("property_id", propertyId);
      const ids = (appIds ?? []).map((a: { id: string }) => a.id);
      if (ids.length) q = q.in("application_id", ids);
      else q = q.eq("application_id", "never-match");
    }
    const { data, error } = await q;

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    const list = (data ?? []).map((r: Record<string, unknown>) => {
      const app = r.applications as {
        id: string;
        tenants: { first_name: string; last_name: string; email: string } | null;
        properties: { id: string; address: string; city: string; state: string; zip: string } | null;
      } | null;
      const tenant = app?.tenants;
      const property = app?.properties;
      return {
        id: r.id,
        category: r.category,
        description: r.description,
        photoUrl: r.photo_url,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "",
        tenantEmail: tenant?.email ?? "",
        propertyId: property?.id ?? null,
        propertyAddress: property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : ""
      };
    });

    return res.status(200).json(list);
  }

  if (req.method !== "POST") return res.status(405).end();

  const { applicationId, email, category, description, photoUrl } = req.body ?? {};
  if (!applicationId || !email || !category || !CATEGORIES.includes(category)) {
    return res.status(400).json({ error: "applicationId, email, and valid category required" });
  }

  const { data: application, error: appError } = await supabaseServer
    .from("applications")
    .select("id, tenants ( email )")
    .eq("id", applicationId)
    .single();

  if (appError || !application) {
    return res.status(404).json({ error: "Application not found" });
  }

  const tenantEmail = (application as { tenants: { email: string } | null }).tenants?.email;
  if ((tenantEmail ?? "").toLowerCase() !== String(email).trim().toLowerCase()) {
    return res.status(403).json({ error: "Email does not match this application" });
  }

  const { data: row, error } = await supabaseServer
    .from("maintenance_requests")
    .insert({
      application_id: applicationId,
      category,
      description: String(description ?? "").trim() || "—",
      photo_url: photoUrl || null,
      status: "submitted"
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  try {
    const { sendMaintenanceReceived } = await import("../../../lib/email");
    await sendMaintenanceReceived(tenantEmail, row.id);
  } catch (e) {
    console.error("Maintenance email error", e);
  }

  return res.status(201).json({ success: true, id: row.id, createdAt: row.created_at });
}
