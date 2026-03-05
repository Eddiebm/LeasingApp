import { supabase } from "../../../lib/supabaseClient";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "pest", "other"] as const;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const { getDashboardUser } = await import("../../../lib/apiAuth");
    const auth = await getDashboardUser(req as unknown as { headers: { authorization?: string } });
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const propertyId = url.searchParams.get("propertyId") ?? undefined;
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
      return json({ error: error.message }, 500);
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

    return json(list);
  }

  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { email, category, description, photoUrl } = body;
  if (!email || !category || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return json({ error: "email and valid category required" }, 400);
  }

  // Look up the most recent application by tenant email
  const { data: application, error: appError } = await supabaseServer
    .from("applications")
    .select("id, tenants ( email )")
    .eq("tenants.email", String(email).trim().toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (appError || !application) {
    return json({ error: "No application found for this email address" }, 404);
  }

  const applicationId = (application as { id: string }).id;
  const tenantEmail = (application as { tenants: { email: string } | null }).tenants?.email;

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
    return json({ error: error.message }, 500);
  }

  try {
    const { sendMaintenanceReceived } = await import("../../../lib/email");
    await sendMaintenanceReceived(tenantEmail, row.id);
  } catch (e) {
    console.error("Maintenance email error", e);
  }

  return json({ success: true, id: row.id, createdAt: row.created_at }, 201);
}
