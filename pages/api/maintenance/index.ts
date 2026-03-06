import { Resend } from "resend";
import { getAdminClient, getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

const URGENCIES = ["low", "medium", "high"] as const;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const BUCKET = "maintenance-photos";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const auth = await getLandlordOrAdmin(req);
    if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);
    const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createSupabaseForUser(token);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    let q = supabase
      .from("maintenance_requests")
      .select(`
        id,
        title,
        description,
        photo_url,
        urgency,
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
        title: r.title,
        description: r.description,
        photoUrl: r.photo_url,
        urgency: r.urgency,
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
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { applicationId, email, unitOrAddress, title, description, urgency, photoBase64, photoFileName } = body as Record<string, unknown>;
  const appId = typeof applicationId === "string" ? applicationId.trim() : "";
  const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
  const titleStr = typeof title === "string" ? title.trim() : "";

  if (!appId || !emailStr || !titleStr) {
    return json({ error: "applicationId, email, and title are required" }, 400);
  }

  const urgencyVal = typeof urgency === "string" && (URGENCIES as readonly string[]).includes(urgency) ? urgency : "medium";

  const supabase = getAdminClient();

  // 1. Look up application by applicationId and get tenant, property, landlord
  const { data: application, error: appError } = await supabase
    .from("applications")
    .select(`
      id,
      tenant_id,
      property_id,
      tenants ( id, first_name, last_name, email ),
      properties ( id, address, city, state, zip, landlord_id )
    `)
    .eq("id", appId)
    .maybeSingle();

  if (appError || !application) {
    return json({ error: "Application not found" }, 404);
  }

  const app = application as {
    id: string;
    tenant_id: string;
    property_id: string | null;
    tenants: { id: string; first_name: string; last_name: string; email: string } | null;
    properties: { id: string; address: string; city: string; state: string; zip: string; landlord_id: string } | null;
  };
  const tenantEmail = app.tenants?.email?.toLowerCase();
  if (tenantEmail !== emailStr) {
    return json({ error: "Email does not match this application" }, 403);
  }

  const tenantId = app.tenants?.id ?? app.tenant_id;
  const propertyId = app.property_id ?? app.properties?.id ?? null;
  const landlordId = app.properties?.landlord_id ?? null;
  const tenantName = app.tenants ? `${app.tenants.first_name} ${app.tenants.last_name}`.trim() : "Tenant";
  const propertyAddress = app.properties
    ? `${app.properties.address}, ${app.properties.city}, ${app.properties.state} ${app.properties.zip}`
    : unitOrAddress && typeof unitOrAddress === "string"
      ? String(unitOrAddress).trim()
      : "";

  // 2. Optional photo upload to maintenance-photos bucket
  let photoUrl: string | null = null;
  if (photoBase64 && typeof photoBase64 === "string") {
    try {
      const base64 = String(photoBase64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > MAX_PHOTO_SIZE) return json({ error: "Photo too large (max 5 MB)" }, 400);
      const ext = (typeof photoFileName === "string" && photoFileName.split(".").pop()) || "jpg";
      const safeName = `maintenance/${appId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(safeName, buffer, {
        contentType: "image/jpeg",
        upsert: true
      });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(safeName);
        photoUrl = urlData.publicUrl;
      }
    } catch (e) {
      console.error("Maintenance photo upload error", e);
      return json({ error: "Invalid photo data" }, 400);
    }
  }

  // 3. Insert maintenance_requests (schema: application_id, tenant_id, property_id, landlord_id, title, description, urgency, status, photo_url)
  const { data: row, error: insertError } = await supabase
    .from("maintenance_requests")
    .insert({
      application_id: appId,
      tenant_id: tenantId,
      property_id: propertyId,
      landlord_id: landlordId,
      title: titleStr,
      description: typeof description === "string" ? String(description).trim() || null : null,
      urgency: urgencyVal,
      status: "open",
      photo_url: photoUrl
    })
    .select("id, created_at")
    .single();

  if (insertError) {
    console.error(insertError);
    return json({ error: insertError.message }, 500);
  }

  const requestId = (row as { id: string }).id;

  // 4. Email landlord (LANDLORD_EMAIL)
  const env = getEnv();
  const landlordEmail = env.LANDLORD_EMAIL;
  if (env.RESEND_API_KEY && landlordEmail) {
    const resend = new Resend(env.RESEND_API_KEY);
    resend.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [landlordEmail],
        subject: `New maintenance request: ${titleStr} — ${urgencyVal} priority`,
        html: `
          <p><strong>Tenant:</strong> ${tenantName}</p>
          <p><strong>Property:</strong> ${propertyAddress || "—"}</p>
          <p><strong>Title:</strong> ${titleStr}</p>
          <p><strong>Urgency:</strong> ${urgencyVal}</p>
          <p><strong>Description:</strong></p>
          <p>${typeof description === "string" ? description.trim() || "—" : "—"}</p>
          ${photoUrl ? `<p><a href="${photoUrl}">View photo</a></p>` : ""}
        `
      })
      .catch(console.error);
  }

  // 5. Optional: send acknowledgement to tenant (spec item 5 - sendMaintenanceAcknowledgementEmail can be wired later)
  if (env.RESEND_API_KEY && tenantEmail) {
    const resend = new Resend(env.RESEND_API_KEY);
    resend.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [app.tenants?.email ?? emailStr],
        subject: `We received your maintenance request: ${titleStr}`,
        html: `
          <p>Hi ${tenantName},</p>
          <p>We've received your maintenance request: <strong>${titleStr}</strong> (${urgencyVal} priority).</p>
          <p>Your landlord will be in touch within 24–48 hours.</p>
        `
      })
      .catch(console.error);
  }

  return json({ success: true, requestId, id: requestId }, 201);
}
