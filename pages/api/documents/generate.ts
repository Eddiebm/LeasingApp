import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { DOCUMENT_TYPE_IDS } from "../../../lib/documentTypes";
import { generateDocument, getFilename } from "../../../lib/documents";
import type { DocumentContext } from "../../../lib/documents/context";

export const runtime = "edge";

function buildContext(
  app: Record<string, unknown>,
  auth: { role: string; landlord?: { full_name: string; company_name: string | null } },
  payload: Record<string, unknown>
): DocumentContext {
  const tenant = app.tenants as { first_name: string; last_name: string; email?: string } | null;
  const property = app.properties as {
    address: string;
    city: string;
    state: string;
    zip: string;
    rent?: number;
    landlords?: { full_name: string; company_name: string | null } | null;
  } | null;

  const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "Tenant";
  const propertyAddress = property
    ? `${property.address}, ${property.city}, ${property.state} ${property.zip}`
    : "Property";

  let landlordName = "Landlord";
  if (auth.role === "landlord" && auth.landlord) {
    landlordName = auth.landlord.company_name || auth.landlord.full_name || landlordName;
  } else if (property?.landlords) {
    const l = property.landlords;
    landlordName = (l.company_name || l.full_name || landlordName) as string;
  }

  const ctx: DocumentContext = {
    tenantName,
    tenantEmail: tenant?.email,
    propertyAddress,
    rent: property?.rent ?? undefined,
    deposit:
      typeof payload.deposit === "number" ? payload.deposit : (property?.rent ?? undefined),
    landlordName,
    moveInDate: typeof payload.moveIn === "string" ? payload.moveIn : undefined,
    dueDate: typeof payload.dueDate === "string" ? payload.dueDate : undefined,
    amountDue: typeof payload.amountDue === "number" ? payload.amountDue : undefined,
    reason: typeof payload.reason === "string" ? payload.reason : undefined,
    noticeBody: typeof payload.noticeBody === "string" ? payload.noticeBody : undefined,
    entryDate: typeof payload.entryDate === "string" ? payload.entryDate : undefined,
    entryTime: typeof payload.entryTime === "string" ? payload.entryTime : undefined,
    depositAmount: typeof payload.depositAmount === "number" ? payload.depositAmount : undefined,
    amountReturned: typeof payload.amountReturned === "number" ? payload.amountReturned : undefined,
    deductions: Array.isArray(payload.deductions)
      ? (payload.deductions as { reason: string; amount: number }[])
      : undefined,
    date: typeof payload.date === "string" ? payload.date : undefined,
  };

  if (property?.rent != null && ctx.rent == null) ctx.rent = property.rent;
  return ctx;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role === null) return res.status(401).json({ error: "Unauthorized" });
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { type, applicationId, ...payload } = req.body ?? {};
  if (!type || typeof type !== "string" || !DOCUMENT_TYPE_IDS.includes(type)) {
    return res.status(400).json({ error: "Invalid or missing document type." });
  }
  if (!applicationId || typeof applicationId !== "string") {
    return res.status(400).json({ error: "Missing applicationId." });
  }

  const supabase = createSupabaseForUser(token);
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select(
      "id, tenants(first_name, last_name, email), properties(address, city, state, zip, rent, landlords(full_name, company_name))"
    )
    .eq("id", applicationId)
    .single();

  if (appError || !app) {
    return res.status(404).json({ error: "Application not found." });
  }

  const ctx = buildContext(app as Record<string, unknown>, auth, payload as Record<string, unknown>);
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateDocument(type, ctx);
  } catch (e) {
    console.error("Document generation error", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to generate document." });
  }

  const bucket = "documents";
  const fileName = getFilename(type, applicationId);
  const { error: uploadError } = await supabaseServer.storage
    .from(bucket)
    .upload(fileName, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    console.error("Document upload error", uploadError);
    return res.status(500).json({ error: "Failed to save document." });
  }

  const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(fileName);
  await supabase.from("documents").insert({
    application_id: applicationId,
    type,
    file_url: urlData.publicUrl,
  });

  if (type === "lease") {
    const signToken =
      crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await supabase.from("applications").update({ lease_sign_token: signToken }).eq("id", applicationId);
    res.setHeader("X-Lease-Sign-Token", signToken);
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  return res.send(Buffer.from(pdfBytes));
}
