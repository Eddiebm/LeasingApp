import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { sendLeaseForSigningEmail } from "../../../lib/email";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);
  if (auth.role !== "landlord" && auth.role !== "admin") return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  const tenantEmail = typeof body.tenantEmail === "string" ? body.tenantEmail.trim().toLowerCase() : "";
  const tenantName = typeof body.tenantName === "string" ? body.tenantName.trim() : "";

  if (!documentId || !tenantEmail || !tenantName) {
    return json({ error: "documentId, tenantEmail, and tenantName are required" }, 400);
  }

  const supabase = getAdminClient();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select(`
      id,
      file_url,
      application_id,
      signed_at,
      applications (
        id,
        properties (
          id,
          landlord_id,
          address,
          city,
          state,
          zip
        )
      )
    `)
    .eq("id", documentId)
    .maybeSingle();

  if (docError || !doc) return json({ error: "Document not found" }, 404);

  const d = doc as {
    id: string;
    file_url: string;
    application_id: string;
    signed_at: string | null;
    applications: {
      id: string;
      properties: { id: string; landlord_id: string; address: string; city: string; state: string; zip: string } | null;
    } | null;
  };

  if (d.signed_at) return json({ error: "This document has already been signed" }, 400);

  const property = d.applications?.properties;
  if (!property) return json({ error: "Document has no associated property" }, 400);

  if (auth.role === "landlord" && auth.landlordId !== property.landlord_id) {
    return json({ error: "You do not own this document" }, 403);
  }

  const signingToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  let documentHash: string | null = null;
  try {
    const res = await fetch(d.file_url);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      documentHash = await sha256Hex(buf);
    }
  } catch (e) {
    console.error("Failed to fetch document for hash", e);
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      signing_token: signingToken,
      signing_token_expires_at: expiresAt,
      tenant_email: tenantEmail,
      document_hash: documentHash
    })
    .eq("id", documentId);

  if (updateError) {
    console.error(updateError);
    return json({ error: updateError.message }, 500);
  }

  const propertyAddress = `${property.address}, ${property.city}, ${property.state} ${property.zip}`;
  const env = getEnv();
  const origin = req.headers.get?.("origin") || req.headers.get?.("referer")?.replace(/\/$/, "") || "https://rentlease.app";
  const signingUrl = `${origin}/sign-lease?token=${encodeURIComponent(signingToken)}`;

  sendLeaseForSigningEmail(tenantEmail, tenantName, propertyAddress, signingUrl, {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>"
  }).catch(console.error);

  return json({ success: true });
}
