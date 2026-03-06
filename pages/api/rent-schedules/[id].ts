import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function getScheduleId(req: Request): string {
  const url = new URL(req.url);
  const segments = url.pathname.split("/");
  const idIndex = segments.indexOf("rent-schedules") + 1;
  return segments[idIndex] ?? "";
}

export default async function handler(req: Request) {
  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);

  const scheduleId = getScheduleId(req).trim();
  if (!scheduleId) return json({ error: "Schedule ID required" }, 400);

  const admin = getAdminClient();
  const { data: schedule, error: fetchErr } = await admin
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
    .eq("id", scheduleId)
    .maybeSingle();

  const payments =
    schedule && !fetchErr
      ? (
          await admin
            .from("rent_payments")
            .select("id, amount_cents, late_fee_cents, status, due_date, paid_at, period_start, period_end")
            .eq("rent_schedule_id", scheduleId)
            .order("created_at", { ascending: false })
            .limit(50)
        ).data ?? []
      : [];

  if (fetchErr || !schedule) return json({ error: "Schedule not found" }, 404);

  const s = schedule as { landlord_id: string };
  if (auth.role === "landlord" && auth.landlordId !== s.landlord_id) return json({ error: "Forbidden" }, 403);

  const mapSchedule = (r: Record<string, unknown>) => {
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
  };

  if (req.method === "GET") {
    const out = mapSchedule(schedule as Record<string, unknown>) as Record<string, unknown>;
    out.payments = (payments as Record<string, unknown>[]).map((p) => ({
      id: p.id,
      amountCents: p.amount_cents,
      lateFeeCents: p.late_fee_cents,
      status: p.status,
      dueDate: p.due_date,
      paidAt: p.paid_at,
      periodStart: p.period_start,
      periodEnd: p.period_end
    }));
    return json(out);
  }

  if (req.method === "PUT") {
    if (auth.role !== "landlord") return json({ error: "Forbidden" }, 403);
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.amountCents === "number") updates.amount_cents = body.amountCents;
    if (typeof body.dueDayOfMonth === "number") updates.due_day_of_month = Math.min(28, Math.max(1, body.dueDayOfMonth));
    if (typeof body.lateFeeCents === "number") updates.late_fee_cents = body.lateFeeCents;
    if (typeof body.lateFeeGraceDays === "number") updates.late_fee_grace_days = body.lateFeeGraceDays;
    if (typeof body.currency === "string") updates.currency = body.currency.toLowerCase();
    if (body.tenantId !== undefined) updates.tenant_id = body.tenantId ? String(body.tenantId) : null;
    if (body.applicationId !== undefined) updates.application_id = body.applicationId ? String(body.applicationId) : null;
    if (typeof body.isActive === "boolean") updates.is_active = body.isActive;

    const { data: updated, error } = await admin
      .from("rent_schedules")
      .update(updates)
      .eq("id", scheduleId)
      .eq("landlord_id", auth.landlordId)
      .select()
      .single();
    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    return json(mapSchedule(updated as Record<string, unknown>));
  }

  if (req.method === "DELETE") {
    if (auth.role !== "landlord") return json({ error: "Forbidden" }, 403);
    const { error } = await admin.from("rent_schedules").delete().eq("id", scheduleId).eq("landlord_id", auth.landlordId);
    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }
    return json({ success: true });
  }

  return new Response(null, { status: 405 });
}
