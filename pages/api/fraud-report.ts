import { getSupabaseServer } from "../../lib/supabaseServer";
export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/fraud-report
 * Body: { propertyId, reporterEmail, reporterName, reason, details }
 * Submits a fraud report for a listing. No auth required (renters are not logged in).
 * After 3 reports for the same property, the property is auto-flagged for review.
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const propertyId = String(body.propertyId ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  const reporterEmail = String(body.reporterEmail ?? "").trim();
  const reporterName = String(body.reporterName ?? "").trim();
  const details = String(body.details ?? "").trim();

  if (!propertyId) return json({ error: "Property ID is required" }, 400);
  if (!reason) return json({ error: "Reason is required" }, 400);

  const db = getSupabaseServer();

  // Insert the fraud report
  const { error: insertError } = await db.from("fraud_reports").insert({
    property_id: propertyId,
    reporter_email: reporterEmail || null,
    reporter_name: reporterName || null,
    reason,
    details: details || null,
    status: "pending",
  });

  if (insertError) {
    console.error("fraud_report insert error:", insertError);
    return json({ error: "Failed to submit report" }, 500);
  }

  // Count total pending/confirmed reports for this property
  const { count } = await db
    .from("fraud_reports")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .in("status", ["pending", "confirmed"]);

  // Auto-flag the property if 3+ reports
  if (count && count >= 3) {
    await db
      .from("properties")
      .update({ ownership_check_status: "flagged" })
      .eq("id", propertyId);
  }

  return json({ success: true, message: "Report submitted. Thank you for helping keep the platform safe." });
}
