import type { NextApiRequest, NextApiResponse } from "next";
import { generateLease } from "../../lib/generateLease";
import { supabaseServer } from "../../lib/supabaseServer";
import { getDashboardUser } from "../../lib/apiAuth";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const auth = await getDashboardUser(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const data = req.body;

  const pdfBytes = await generateLease({
    tenant: data.tenant,
    property: data.property,
    rent: Number(data.rent) || 0,
    deposit: Number(data.deposit) || 0,
    moveIn: data.moveIn ?? "",
    landlord: data.landlord ?? "Eddie Bannerman-Menson"
  });

  const applicationId = data.applicationId;

  if (applicationId && supabaseServer) {
    try {
      const bucket = "documents";
      const fileName = `lease-${applicationId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabaseServer.storage
        .from(bucket)
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(fileName);
        await supabaseServer.from("documents").insert({
          application_id: applicationId,
          type: "lease",
          file_url: urlData.publicUrl
        });
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await supabaseServer.from("applications").update({ lease_sign_token: token }).eq("id", applicationId);
        res.setHeader("X-Lease-Sign-Token", token);
      }
    } catch (e) {
      console.error("Document storage error", e);
    }
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="lease.pdf"');
  return res.send(Buffer.from(pdfBytes));
}
