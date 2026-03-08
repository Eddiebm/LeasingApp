import { generateLease } from "../../lib/generateLease";
import { getLandlordOrAdmin, getAdminClient } from "../../lib/apiAuth";
import { createSupabaseForUser } from "../../lib/supabaseUser";

export const runtime = "edge";

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role === null) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }
  const supabase = createSupabaseForUser(token);

  let data: Record<string, unknown> = {};
  try { data = await req.json(); } catch { /* empty body */ }

  const pdfBytes = await generateLease({
    tenant: data.tenant as string,
    property: data.property as string,
    rent: Number(data.rent) || 0,
    deposit: Number(data.deposit) || 0,
    moveIn: (data.moveIn as string) ?? "",
    landlord: (data.landlord as string) ?? "Eddie RentLease-Menson"
  });

  const applicationId = data.applicationId as string | undefined;
  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": 'attachment; filename="lease.pdf"'
  };

  if (applicationId) {
    try {
      const admin = getAdminClient();
      const bucket = "documents";
      const fileName = `lease-${applicationId}-${Date.now()}.pdf`;
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(fileName, pdfBytes, { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        const { data: urlData } = admin.storage.from(bucket).getPublicUrl(fileName);
        await supabase.from("documents").insert({
          application_id: applicationId,
          type: "lease",
          file_url: urlData.publicUrl
        });
        const signToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        await supabase.from("applications").update({ lease_sign_token: signToken }).eq("id", applicationId);
        responseHeaders["X-Lease-Sign-Token"] = signToken;
      }
    } catch (e) {
      console.error("Document storage error", e);
    }
  }

  return new Response(pdfBytes, { status: 200, headers: responseHeaders });
}
