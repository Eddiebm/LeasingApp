import { generateLease } from "../../lib/generateLease";
import { getDashboardUser, getAdminClient } from "../../lib/apiAuth";

export const runtime = "edge";

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getDashboardUser(req);
  if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });

  let data: Record<string, unknown> = {};
  try { data = await req.json(); } catch { /* empty body */ }

  const pdfBytes = await generateLease({
    tenant: data.tenant as string,
    property: data.property as string,
    rent: Number(data.rent) || 0,
    deposit: Number(data.deposit) || 0,
    moveIn: (data.moveIn as string) ?? "",
    landlord: (data.landlord as string) ?? "Eddie Bannerman-Menson"
  });

  const applicationId = data.applicationId as string | undefined;
  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="lease.pdf"'
  };

  if (applicationId) {
    try {
      const bucket = "documents";
      const fileName = `lease-${applicationId}-${Date.now()}.pdf`;
      const { error: uploadError } = await getAdminClient().storage
        .from(bucket)
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        const { data: urlData } = getAdminClient().storage.from(bucket).getPublicUrl(fileName);
        await getAdminClient().from("documents").insert({
          application_id: applicationId,
          type: "lease",
          file_url: urlData.publicUrl
        });
        const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await getAdminClient().from("applications").update({ lease_sign_token: token }).eq("id", applicationId);
        responseHeaders["X-Lease-Sign-Token"] = token;
      }
    } catch (e) {
      console.error("Document storage error", e);
    }
  }

  return new Response(pdfBytes, { status: 200, headers: responseHeaders });
}
