import type { NextApiRequest, NextApiResponse } from "next";
import { PDFDocument } from "pdf-lib";
import { supabaseServer } from "../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const token = (req.query.token as string)?.trim();
    if (!token) return res.status(400).json({ error: "Missing token" });

    const { data: app, error } = await supabaseServer
      .from("applications")
      .select("id, lease_signed_at, lease_signed_pdf_url, tenants ( first_name, last_name ), properties ( address, city, state, zip )")
      .eq("lease_sign_token", token)
      .single();

    if (error || !app) return res.status(404).json({ error: "Invalid or expired link" });
    if ((app as { lease_signed_at: string | null }).lease_signed_at) {
      return res.status(200).json({
        signed: true,
        signedPdfUrl: (app as { lease_signed_pdf_url: string | null }).lease_signed_pdf_url
      });
    }

    const tenant = (app as { tenants: { first_name: string; last_name: string } | null }).tenants;
    const prop = (app as { properties: { address: string; city: string; state: string; zip: string } | null }).properties;
    return res.status(200).json({
      signed: false,
      tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "",
      propertyAddress: prop ? `${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}` : ""
    });
  }

  if (req.method !== "POST") return res.status(405).end();

  const { token: bodyToken, signatureDataUrl } = req.body ?? {};
  const token = String(bodyToken ?? "").trim();
  if (!token || !signatureDataUrl || typeof signatureDataUrl !== "string") {
    return res.status(400).json({ error: "Missing token or signature" });
  }

  const { data: app, error: appError } = await supabaseServer
    .from("applications")
    .select("id, lease_sign_token")
    .eq("lease_sign_token", token)
    .single();

  if (appError || !app || (app as { lease_sign_token: string }).lease_sign_token !== token) {
    return res.status(404).json({ error: "Invalid or expired link" });
  }

  const applicationId = (app as { id: string }).id;
  const { data: doc } = await supabaseServer
    .from("documents")
    .select("file_url")
    .eq("application_id", applicationId)
    .eq("type", "lease")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  const leaseUrl = (doc as { file_url: string } | null)?.file_url;
  if (!leaseUrl) return res.status(400).json({ error: "Lease document not found" });

  try {
    const [leaseRes, sigMatch] = await Promise.all([
      fetch(leaseUrl),
      Promise.resolve(signatureDataUrl.match(/^data:image\/(\w+);base64,(.+)$/))
    ]);
    if (!leaseRes.ok) throw new Error("Could not fetch lease PDF");
    const leaseBytes = new Uint8Array(await leaseRes.arrayBuffer());
    if (!sigMatch) return res.status(400).json({ error: "Invalid signature format" });
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
    const { error: uploadErr } = await supabaseServer.storage
      .from(bucket)
      .upload(signedPath, signedPdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(signedPath);
    const signedPdfUrl = urlData.publicUrl;

    await supabaseServer
      .from("applications")
      .update({
        lease_signed_at: new Date().toISOString(),
        lease_signed_pdf_url: signedPdfUrl,
        lease_sign_token: null
      })
      .eq("id", applicationId);

    return res.status(200).json({ success: true, signedPdfUrl });
  } catch (e) {
    console.error("Sign lease error", e);
    return res.status(500).json({ error: "Failed to save signature" });
  }
}
