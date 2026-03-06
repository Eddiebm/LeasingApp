import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  if (req.method === "GET") {
    const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createSupabaseForUser(token);
    let q = supabase
      .from("rent_schedules")
      .select(`
        id,
        landlord_id,
        property_id,
        tenant_id,
        application_id,
        amount_cents,
        currency,
        due_day_of_month,
        late_fee_cents,
        late_fee_grace_days,
        is_active,
        autopay_enabled,
        created_at,
        updated_at,
        properties ( id, address, city, state, zip ),
        tenants ( id, first_name, last_name, email )
      `)
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (propertyId) q = q.eq("property_id", propertyId);
    const { data, error } = await q;
    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    const list = (data ?? []).map((r: Record<string, unknown>) => {
      const p = r.properties as { address: string; city: string; state: string; zip: string } | null;
      const t = r.tenants as { first_name: string; last_name: string; email: string } | null;
      return {
        id: r.id,
        landlordId: r.landlord_id,
        propertyId: r.property_id,
        tenantId: r.tenant_id,
        applicationId: r.application_id,
        amountCents: r.amount_cents,
        currency: r.currency,
        dueDayOfMonth: r.due_day_of_month,
        lateFeeCents: r.late_fee_cents,
        lateFeeGraceDays: r.late_fee_grace_days,
        isActive: r.is_active,
        autopayEnabled: r.autopay_enabled,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        propertyAddress: p ? `${p.address}, ${p.city}, ${p.state} ${p.zip}` : "",
        tenantName: t ? `${t.first_name} ${t.last_name}`.trim() : null,
        tenantEmail: t?.email ?? null
      };
    });
    return json(list);
  }

  if (req.method !== "POST") return new Response(null, { status: 405 });
  if (auth.role !== "landlord") return json({ error: "Forbidden" }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const propertyId = typeof body.propertyId === "string" ? body.propertyId.trim() : "";
  const amountCents = typeof body.amountCents === "number" ? body.amountCents : Number(body.amountCents);
  const dueDayOfMonth = typeof body.dueDayOfMonth === "number" ? body.dueDayOfMonth : Math.min(28, Math.max(1, Number(body.dueDayOfMonth) || 1));
  const lateFeeCents = typeof body.lateFeeCents === "number" ? body.lateFeeCents : Number(body.lateFeeCents) || 5000;
  const lateFeeGraceDays = typeof body.lateFeeGraceDays === "number" ? body.lateFeeGraceDays : Number(body.lateFeeGraceDays) || 5;
  const currency = (typeof body.currency === "string" ? body.currency : "usd").toLowerCase();
  const tenantId = body.tenantId ? String(body.tenantId).trim() : null;
  const applicationId = body.applicationId ? String(body.applicationId).trim() : null;

  if (!propertyId || !amountCents || amountCents < 1) return json({ error: "propertyId and amountCents required" }, 400);

  const admin = getAdminClient();
  const { data: property } = await admin.from("properties").select("id, landlord_id").eq("id", propertyId).maybeSingle();
  if (!property || (property as { landlord_id: string }).landlord_id !== auth.landlordId) {
    return json({ error: "Property not found or access denied" }, 404);
  }

  const { data: row, error } = await admin
    .from("rent_schedules")
    .insert({
      landlord_id: auth.landlordId,
      property_id: propertyId,
      tenant_id: tenantId,
      application_id: applicationId,
      amount_cents: amountCents,
      currency,
      due_day_of_month: dueDayOfMonth,
      late_fee_cents: lateFeeCents,
      late_fee_grace_days: lateFeeGraceDays,
      is_active: true
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }
  return json({ id: (row as { id: string }).id, createdAt: (row as { created_at: string }).created_at }, 201);
}
