import { Resend } from "resend";
import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getEnv } from "../../../lib/cloudflareEnv";

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
    const auth = await getLandlordOrAdmin(req);
    if (!auth || auth.role === null) return json({ error: "Unauthorized" }, 401);
    const token = req.headers.get?.("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization")!.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);
    const supabase = createSupabaseForUser(token);
    const propertyId = url.searchParams.get("propertyId") ?? undefined;
    let q = supabase
      .from("applications")
      .select(`
        id,
        status,
        credit_score,
        income,
        previous_landlord,
        created_at,
        tenants ( first_name, last_name, email, phone ),
        properties ( id, address, city, state, zip, rent ),
        payments ( status, payment_type )
      `)
      .order("created_at", { ascending: false });
    if (propertyId) q = q.eq("property_id", propertyId);
    const { data: applications, error } = await q;

    if (error) {
      console.error(error);
      return json({ error: error.message }, 500);
    }

    const list = (applications ?? []).map((a: Record<string, unknown>) => {
      const tenant = a.tenants as { first_name: string; last_name: string; email: string; phone: string } | null;
      const property = a.properties as { id: string; address: string; city: string; state: string; zip: string; rent: number } | null;
      const payments = (a.payments as { status: string; payment_type: string }[] | null) ?? [];
      const hasPaidScreening = payments.some((p) => p.payment_type === "screening_fee" && p.status === "paid");
      const screeningStatus: "not_paid" | "paid_pending" | "complete" =
        a.credit_score != null ? "complete" : hasPaidScreening ? "paid_pending" : "not_paid";
      return {
        id: a.id,
        status: a.status,
        creditScore: a.credit_score,
        income: a.income,
        previousLandlord: a.previous_landlord,
        createdAt: a.created_at,
        tenantName: tenant ? `${tenant.first_name} ${tenant.last_name}` : "",
        tenantEmail: tenant?.email ?? "",
        tenantPhone: tenant?.phone ?? "",
        propertyId: property?.id ?? null,
        propertyAddress: property ? `${property.address}, ${property.city}, ${property.state} ${property.zip}` : "",
        rent: property?.rent ?? null,
        screeningStatus
      };
    });

    return json(list);
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const required = ["firstName", "lastName", "phone", "email", "dob"];
  for (const key of required) {
    if (!data[key] || String(data[key]).trim() === "") {
      return json({ error: `Missing required field: ${key}` }, 400);
    }
  }

  const db = getAdminClient();
  if (data.landlordSlug && data.propertyId) {
    const slug = String(data.landlordSlug);
    const propertyId = String(data.propertyId);
    const { data: landlord, error: landlordError } = await db.from("landlords").select("id").eq("slug", slug).maybeSingle();
    if (landlordError) {
      console.error(landlordError);
      return json({ error: landlordError.message }, 500);
    }
    if (!landlord) return json({ error: "Unknown landlord for this application link." }, 400);
    const { data: property, error: propertyError } = await db.from("properties").select("id, landlord_id").eq("id", propertyId).maybeSingle();
    if (propertyError) {
      console.error(propertyError);
      return json({ error: propertyError.message }, 500);
    }
    if (!property || property.landlord_id !== landlord.id) {
      return json({ error: "Selected property does not belong to this landlord. Please refresh and try again." }, 400);
    }
  }

  const adminClient = getAdminClient();

  // Insert tenant record
  const { data: tenantRow, error: tenantError } = await adminClient
    .from("tenants")
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      phone: data.phone,
      email: data.email,
      dob: data.dob,
      ssn_last4: data.ssnLast4 ?? null
    })
    .select("id")
    .single();

  if (tenantError || !tenantRow) {
    console.error(tenantError);
    return json({ error: tenantError?.message ?? "Failed to create tenant" }, 500);
  }

  const incomeNum = data.monthlyIncome
    ? parseFloat(String(data.monthlyIncome).replace(/[^0-9.]/g, ""))
    : null;

  const { data: appRow, error: appError } = await adminClient
    .from("applications")
    .insert({
      property_id: data.propertyId || null,
      tenant_id: (tenantRow as { id: string }).id,
      employment: data.employer ? `${data.employer} – ${data.position || ""}`.trim() : null,
      income: incomeNum,
      previous_landlord: data.previousLandlord || null,
      current_address: data.currentAddress || null,
      reason_for_leaving: data.reasonForLeaving || null,
      monthly_rent: data.monthlyRent || null,
      years_employed: data.yearsEmployed || null,
      credit_consent: data.creditConsent === true,
      background_consent: data.backgroundConsent === true,
      signature: data.signature || null,
      status: "pending"
    })
    .select("id")
    .single();

  if (appError || !appRow) {
    console.error(appError);
    return json({ error: appError?.message ?? "Failed to create application" }, 500);
  }

  const appId = (appRow as { id: string }).id;
  const env = getEnv();
  const resendKey = env.RESEND_API_KEY;
  const landlordEmail = env.LANDLORD_EMAIL;
  if (resendKey && landlordEmail) {
    const resend = new Resend(resendKey);
    const tenantName = `${String(data.firstName).trim()} ${String(data.lastName).trim()}`;
    const origin = req.headers.get?.("origin") || req.headers.get?.("referer")?.replace(/\/$/, "") || "https://leasingapp.pages.dev";
    const dashboardLink = `${origin}/dashboard`;
    resend.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [landlordEmail],
        subject: "New rental application submitted",
        html: `
          <p>A new application has been submitted.</p>
          <p><strong>Tenant:</strong> ${tenantName}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          <p><strong>Phone:</strong> ${data.phone}</p>
          <p><strong>DOB:</strong> ${data.dob}</p>
          <p><a href="${dashboardLink}">View in dashboard</a></p>
        `
      })
      .catch(console.error);
  }
  if (env.RESEND_API_KEY && data.email) {
    const origin = req.headers.get?.("origin") || req.headers.get?.("referer")?.replace(/\/$/, "") || "https://leasingapp.pages.dev";
    const portalLink = `${origin}/portal?id=${encodeURIComponent(appId)}&email=${encodeURIComponent(String(data.email).trim())}`;
    const resendTenant = new Resend(env.RESEND_API_KEY);
    resendTenant.emails
      .send({
        from: env.EMAIL_FROM ?? "Leasing <onboarding@resend.dev>",
        to: [data.email],
        subject: "We've received your application",
        html: `
          <p>We've received your rental application.</p>
          <p><strong>Application ID:</strong> ${appId}</p>
          <p>You'll hear from us within 2–3 business days.</p>
          <p><a href="${portalLink}">Check your status</a></p>
        `
      })
      .catch(console.error);
  }

  return json({ success: true, applicationId: appId });
}
