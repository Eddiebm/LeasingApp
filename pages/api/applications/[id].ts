import { Resend } from "resend";
import { getDashboardUser, getAdminClient } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getEnv } from "../../../lib/cloudflareEnv";
import { generateDocument, getFilename } from "../../../lib/documents";
import type { DocumentContext } from "../../../lib/documents/context";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").pop() ?? "";
  if (!id) return json({ error: "Missing application id" }, 400);

  if (req.method === "PATCH") {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const { signature: bodySignature, signed_at: bodySignedAt, email: bodyEmail, status, changedBy, leaseStartAt, leaseEndAt } = body as {
      signature?: string; signed_at?: string; email?: string; status?: string; changedBy?: string;
      leaseStartAt?: string | null;
      leaseEndAt?: string | null;
    };
    const isTenantSigning = !req.headers.get?.("authorization") && typeof bodySignature === "string" && bodySignature.trim() && typeof bodySignedAt === "string" && typeof bodyEmail === "string";

    if (isTenantSigning) {
      const supabase = getAdminClient();
      const { data: app } = await supabase
        .from("applications")
        .select("id, tenants ( email )")
        .eq("id", id)
        .single();
      const tenantEmail = (app as { tenants: { email: string } | null } | null)?.tenants?.email?.toLowerCase();
      if (tenantEmail !== String(bodyEmail).trim().toLowerCase()) {
        return json({ error: "Access denied" }, 403);
      }
      const { error: updateErr } = await supabase
        .from("applications")
        .update({
          signature: bodySignature.trim(),
          lease_signed_at: bodySignedAt,
          updated_at: new Date().toISOString()
        })
        .eq("id", id);
      if (updateErr) {
        console.error(updateErr);
        return json({ error: updateErr.message }, 500);
      }
      return json({ success: true });
    }

    const auth = await getDashboardUser(req);
    if (!auth) return json({ error: "Unauthorized" }, 401);
    const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createSupabaseForUser(token);
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return json({ error: "Invalid status" }, 400);
    }

    const { data: existing } = await supabase.from("applications").select("status, tenants ( first_name, last_name, email )").eq("id", id).single();
    const fromStatus = (existing as { status?: string } | null)?.status ?? null;
    const tenant = (existing as { tenants: { first_name: string; last_name: string; email: string } | null } | null)?.tenants;

    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (leaseStartAt !== undefined) updates.lease_start_at = typeof leaseStartAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(leaseStartAt.trim()) ? leaseStartAt.trim() : null;
    if (leaseEndAt !== undefined) updates.lease_end_at = typeof leaseEndAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(leaseEndAt.trim()) ? leaseEndAt.trim() : null;

    const { error } = await supabase.from("applications").update(updates).eq("id", id);

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }

    await supabase.from("application_status_history").insert({
      application_id: id,
      from_status: fromStatus,
      to_status: status,
      changed_by: changedBy ?? auth.email
    });

    const env = getEnv();
    const resendKey = env.RESEND_API_KEY;
    const tenantEmail = tenant?.email;
    if (resendKey && tenantEmail) {
      const resend = new Resend(resendKey);
      const tenantName = tenant ? `${tenant.first_name} ${tenant.last_name}`.trim() : "Applicant";
      const from = env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>";
      const origin = req.headers.get?.("origin") || req.headers.get?.("referer")?.replace(/\/$/, "") || "https://leasingapp.pages.dev";
      if (status === "approved") {
        const signLink = `${origin}/sign-lease?token=${encodeURIComponent(id)}`;
        resend.emails
          .send({
            from,
            to: [tenantEmail],
            subject: "Application approved – sign your lease",
            html: `<p>Hi ${tenantName},</p><p>Your rental application has been approved. Please sign your lease here:</p><p><a href="${signLink}">Sign your lease</a></p><p>You can also check your status in the <a href="${origin}/portal">tenant portal</a>.</p>`
          })
          .catch(console.error);

        try {
          const admin = getAdminClient();
          const { data: appRow } = await admin
            .from("applications")
            .select("id, tenants(first_name, last_name, email), properties(address, city, state, zip, rent, landlords(full_name, company_name))")
            .eq("id", id)
            .single();
          if (appRow) {
            const app = appRow as Record<string, unknown>;
            const tenantRow = app.tenants as { first_name: string; last_name: string; email?: string } | null;
            const property = app.properties as {
              address: string; city: string; state: string; zip: string; rent?: number;
              landlords?: { full_name: string; company_name: string | null } | null;
            } | null;
            const tenantNameStr = tenantRow ? `${tenantRow.first_name} ${tenantRow.last_name}`.trim() : "Tenant";
            const propertyAddress = property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "Property";
            let landlordName = "Landlord";
            if (property?.landlords) {
              const l = property.landlords;
              landlordName = l.company_name || l.full_name || landlordName;
            }
            const moveIn = new Date();
            moveIn.setMonth(moveIn.getMonth() + 1);
            moveIn.setDate(1);
            const moveInStr = moveIn.toISOString().slice(0, 10);
            const ctx: DocumentContext = {
              tenantName: tenantNameStr,
              tenantEmail: tenantRow?.email,
              propertyAddress,
              rent: property?.rent,
              deposit: property?.rent,
              landlordName,
              moveInDate: moveInStr
            };
            const pdfBytes = await generateDocument("lease", ctx);
            const bucket = "documents";
            const fileName = getFilename("lease", id);
            const { error: uploadErr } = await admin.storage.from(bucket).upload(fileName, Buffer.from(pdfBytes), { contentType: "application/pdf", upsert: true });
            if (!uploadErr) {
              const { data: urlData } = admin.storage.from(bucket).getPublicUrl(fileName);
              await admin.from("documents").insert({ application_id: id, type: "lease", file_url: urlData.publicUrl });
              await admin.from("applications").update({ lease_sign_token: id }).eq("id", id);
            }
          }
        } catch (e) {
          console.error("Lease generation on approve", e);
        }
      } else if (status === "rejected") {
        resend.emails
          .send({
            from,
            to: [tenantEmail],
            subject: "Update on your rental application",
            html: `<p>Hi ${tenantName},</p><p>Thank you for your interest. After review, we are unable to move forward with your application at this time. We wish you the best in your housing search.</p>`
          })
          .catch(console.error);
      }
    }

    return json({ success: true });
  }

  return new Response(null, { status: 405 });
}
