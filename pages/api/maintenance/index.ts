import { Resend } from "resend";
import { getAdminClient, getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getEnv } from "../../../lib/cloudflareEnv";

export const runtime = "edge";

export const config = { api: { bodyParser: { sizeLimit: "6mb" } } };

const CATEGORIES = ["plumbing", "electrical", "hvac", "appliance", "pest", "other"] as const;
const URGENCIES = ["low", "medium", "high"] as const;
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

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
  const { applicationId: bodyAppId, email, category, description, title, urgency, photoUrl, photoBase64, photoFileName } = body as Record<string, unknown>;
  if (!bodyAppId || !email || !category || !CATEGORIES.includes(category as typeof CATEGORIES[number])) {
    return json({ error: "applicationId, email, and valid category required" }, 400);
  }

  const supabase = getAdminClient();
  const { data: application, error: appError } = await supabase
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

  let resolvedPhotoUrl: string | null = typeof photoUrl === "string" ? photoUrl : null;
  if (!resolvedPhotoUrl && photoBase64 && typeof photoBase64 === "string") {
    try {
      const base64 = String(photoBase64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > MAX_PHOTO_SIZE) return json({ error: "Photo too large (max 5 MB)" }, 400);
      const ext = (photoFileName as string)?.split(".").pop() || "jpg";
      const safeName = `maintenance/${applicationId}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(safeName, buffer, { contentType: "image/jpeg", upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(safeName);
        resolvedPhotoUrl = urlData.publicUrl;
      }
    } catch (e) {
      console.error("Maintenance photo upload error", e);
      return json({ error: "Invalid photo data" }, 400);
    }
  }
  const urgencyLabel = typeof urgency === "string" && URGENCIES.includes(urgency as typeof URGENCIES[number]) ? urgency : "medium";
  const titlePart = typeof title === "string" && String(title).trim() ? `Title: ${String(title).trim()}\n\n` : "";
  const descBody = String(description ?? "").trim() || "—";
  const fullDescription = `Urgency: ${urgencyLabel}\n${titlePart}${descBody}`;

  const { data: row, error } = await supabase
    .from("maintenance_requests")
    .insert({
      application_id: applicationId,
      category,
      description: fullDescription,
      photo_url: resolvedPhotoUrl,
      status: "submitted"
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  const ticketId = (row as { id: string }).id;
  const env = getEnv();
  if (env.RESEND_API_KEY && tenantEmail) {
    const resend = new Resend(env.RESEND_API_KEY);
    resend.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [tenantEmail],
        subject: "Maintenance request received – Ticket #" + ticketId.slice(0, 8),
        html: `
          <p>We've received your maintenance request.</p>
          <p><strong>Ticket number:</strong> ${ticketId}</p>
          <p>We'll update you on progress. You can reference this ticket number when following up.</p>
        `
      })
      .catch(console.error);
  }

  return json({ success: true, id: ticketId, createdAt: (row as { created_at: string }).created_at }, 201);
}
