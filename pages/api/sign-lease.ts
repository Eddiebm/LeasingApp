import { PDFDocument } from "pdf-lib";
import { getSupabaseServer } from "../../lib/getSupabaseServer()";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("token")?.trim() ?? "";
    if (!token) return json({ error: "Missing token" }, 400);

    const { data: app, error } = await getSupabaseServer()
      .from("applications")
      .select("id, lease_signed_at, lease_signed_pdf_url, tenants ( first_name, last_name ), properties ( address, city, state, zip )")
      .eq("lease_sign_token", token)
      .single();

    if (error || !app) return json({ error: "Invalid or expired link" }, 404);
    if ((app as { lease_signed_at: string | null }).lease_signed_at) {
      return json({
        signed: true,
        signedPdfUrl: (app as { lease_signed_pdf_url: string | null }).lease_signed_pdf_url
      });
    }

    const tenant = (app as { tenants: { first_name: string; last_name: string } | null }).tenants;
    const prop = (app as { properties: { address: string; city: string; state: string; zip: string } | null }).properties;
    return json({
      signed: false,
      tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "",
      propertyAddress: prop ? `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}` : ""
    });
  }

  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { token: bodyToken, signatureDataUrl } = body;
  const token = String(bodyToken ?? "").trim();
  if (!token || !signatureDataUrl || typeof signatureDataUrl !== "string") {
    return json({ error: "Missing token or signature" }, 400);
  }

  const { data: app, error: appError } = await getSupabaseServer()
    .from("applications")
    .select("id, lease_sign_token")
    .eq("lease_sign_token", token)
    .single();

    if (appError || !app || (app as { lease_sign_token: string }).lease_sign_token !== token) {
    return json({ error: "Invalid or expired link" }, 404);
  }

  const applicationId = (app as { id: string }).id;
  const { data: doc } = await getSupabaseServer()
    .from("documents")
    .select("file_url")
    .eq("application_id", applicationId)
    .eq("type", "lease")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const leaseUrl = (doc as { file_url: string } | null)?.file_url;
  if (!leaseUrl) return json({ error: "Lease document not found" }, 400);

  try {
    const [leaseRes, sigMatch] = await Promise.all([
      fetch(leaseUrl),
      Promise.resolve(signatureDataUrl.match(/^data:image\/(\w+);base64,(.+)$/))
    ]);
    if (!leaseRes.ok) throw new Error("Could not fetch lease PDF");
    const leaseBytes = new Uint8Array(await leaseRes.arrayBuffer());
    if (!sigMatch) return json({ error: "Invalid signature format" }, 400);
    const base64 = sigMatch[2];
    const sigBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const pdfDoc = await PDFDocument.load(leaseBytes);
    const page = pdfDoc.addPage([612, 792]);
    const { height } = page.getSize();
    page.drawText("Signed by tenant (e-signature):", { x: 50, y: height - 60, size: 12 });
    const img = await pdfDoc.embedPng(sigBytes);
    const scale = Math.min(200 / img.width, 80 / img.height, 1);
    page.drawImage(img, { x: 50, y: height - 160, width: img.width * scale, height: img.height * scale });
    page.drawText(`Date: ${new Date().toISOString().slice(0, 10)}`, { x: 50, y: height - 180, size: 10 });
    const signedPdfBytes = await pdfDoc.save();

    const bucket = "documents";
    const signedPath = `lease-signed-${applicationId}-${Date.now()}.pdf`;
    const { error: uploadErr } = await getSupabaseServer().storage
      .from(bucket)
      .upload(signedPath, signedPdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) throw uploadErr;
    const { data: urlData } = getSupabaseServer().storage.from(bucket).getPublicUrl(signedPath);
    const signedPdfUrl = urlData.publicUrl;

    await getSupabaseServer()
      .from("applications")
      .update({
        lease_signed_at: new Date().toISOString(),
        lease_signed_pdf_url: signedPdfUrl,
        lease_sign_token: null
      })
      .eq("id", applicationId);

    return json({ success: true, signedPdfUrl });
  } catch (e) {
    console.error("Sign lease error", e);
    return json({ error: "Failed to save signature" }, 500);
  }
}
