import { getAdminClient } from "../../../lib/apiAuth";
import { getEnv } from "../../../lib/cloudflareEnv";
import { generateSignedPdf } from "../../../lib/generateSignedPdf";
import { sendSignedLeaseEmail } from "../../../lib/email";

export const runtime = "edge";

const BUCKET = "signed-leases";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getClientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ?? "";
}

function getUserAgent(req: Request): string {
  return req.headers.get("User-Agent") ?? "";
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const signedByName = typeof body.signedByName === "string" ? body.signedByName.trim() : "";

  if (!token) return json({ error: "Missing token" }, 400);
  if (!signedByName) return json({ error: "signedByName is required" }, 400);

  const supabase = getAdminClient();

  const { data: doc, error: docError } = await supabase
    .from("documents")
    .select(`
      id,
      file_url,
      signing_token_expires_at,
      signed_at,
      document_hash,
      tenant_email,
      applications (
        id,
        tenants ( first_name, last_name, email ),
        properties (
          address,
          city,
          state,
          zip,
          landlord_id,
          landlords ( email, full_name )
        )
      )
    `)
    .eq("signing_token", token)
    .maybeSingle();

  if (docError || !doc) return json({ error: "Invalid or expired link" }, 404);

  const d = doc as {
    id: string;
    file_url: string;
    signing_token_expires_at: string | null;
    signed_at: string | null;
    document_hash: string | null;
    tenant_email: string | null;
    applications: {
      id: string;
      tenants: { first_name: string; last_name: string; email: string } | null;
      properties: {
        address: string;
        city: string;
        state: string;
        zip: string;
        landlord_id: string;
        landlords: { email: string; full_name: string } | null;
      } | null;
    } | null;
  };

  const now = new Date().toISOString();
  if (d.signing_token_expires_at && d.signing_token_expires_at < now) {
    return json({ error: "This signing link has expired" }, 400);
  }
  if (d.signed_at) return json({ error: "This document has already been signed" }, 400);

  const property = d.applications?.properties;
  const propertyAddress = property
    ? `${property.address}, ${property.city}, ${property.state} ${property.zip}`
    : "";

  let leaseBytes: Uint8Array;
  try {
    const res = await fetch(d.file_url);
    if (!res.ok) throw new Error("Could not fetch lease PDF");
    leaseBytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error("Fetch lease PDF error", e);
    return json({ error: "Could not load lease document" }, 500);
  }

  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  const signedPdfBytes = await generateSignedPdf(leaseBytes, {
    propertyAddress,
    signedByName,
    signedAtIso: now,
    ipAddress: ip,
    documentHash: d.document_hash
  });

  const fileName = `signed-${d.id}-${Date.now()}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, signedPdfBytes, { contentType: "application/pdf", upsert: true });

  if (uploadErr) {
    console.error("Upload signed PDF error", uploadErr);
    return json({ error: "Failed to save signed document" }, 500);
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  const signedPdfUrl = urlData.publicUrl;

  const { error: updateErr } = await supabase
    .from("documents")
    .update({
      signed_at: now,
      signed_by_name: signedByName,
      signed_by_ip: ip,
      signed_by_user_agent: userAgent,
      signed_pdf_url: signedPdfUrl,
      signing_token: null,
      signing_token_expires_at: null
    })
    .eq("id", d.id);

  if (updateErr) {
    console.error(updateErr);
    return json({ error: "Failed to update record" }, 500);
  }

  const tenantEmail = d.tenant_email ?? d.applications?.tenants?.email ?? "";
  const tenantName = d.applications?.tenants
    ? `${d.applications.tenants.first_name} ${d.applications.tenants.last_name}`.trim()
    : "Tenant";

  let landlordEmail = (property as { landlords?: { email: string; full_name: string } | null })?.landlords?.email ?? "";
  let landlordName = (property as { landlords?: { email: string; full_name: string } | null })?.landlords?.full_name ?? "Landlord";
  if (!landlordEmail && property?.landlord_id) {
    const { data: landlordRow } = await supabase
      .from("landlords")
      .select("email, full_name")
      .eq("id", property.landlord_id)
      .maybeSingle();
    if (landlordRow) {
      landlordEmail = (landlordRow as { email: string }).email ?? "";
      landlordName = (landlordRow as { full_name: string }).full_name ?? "Landlord";
    }
  }
  const env = getEnv();

  const emailOpts = {
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>"
  };

  if (tenantEmail) {
    sendSignedLeaseEmail(
      tenantEmail,
      tenantName,
      propertyAddress,
      signedPdfUrl,
      tenantName,
      now,
      emailOpts
    ).catch(console.error);
  }
  if (landlordEmail) {
    sendSignedLeaseEmail(
      landlordEmail,
      landlordName,
      propertyAddress,
      signedPdfUrl,
      tenantName,
      now,
      emailOpts
    ).catch(console.error);
  }

  return json({ success: true, signedPdfUrl });
}
