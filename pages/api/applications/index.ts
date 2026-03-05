import { supabase } from "../../../lib/supabaseClient";
import { getSupabaseServer } from "../../../lib/supabaseServer";
import { getDashboardUser } from "../../../lib/apiAuth";

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
    const auth = await getDashboardUser(req as unknown as { headers: { authorization?: string } });
    if (!auth) return json({ error: "Unauthorized" }, 401);

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
        properties ( id, address, city, state, zip, rent )
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
        rent: property?.rent ?? null
      };
    });

    return json(list);
  }

  if (req.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  // Guard: SUPABASE_SERVICE_ROLE_KEY must be set for server-side writes
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not set – add it in Cloudflare env vars");
    return json({ error: "Server misconfigured. Please try again later." }, 503);
  }

  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Validate required fields
  const required = ["firstName", "lastName", "phone", "email", "dob"];
  for (const key of required) {
    if (!data[key] || String(data[key]).trim() === "") {
      return json({ error: `Missing required field: ${key}` }, 400);
    }
  }

  const db = getSupabaseServer();

  // Insert tenant record
  const { data: tenantRow, error: tenantError } = await db
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

  // Insert application record — includes all form fields from migration 001
  const { data: appRow, error: appError } = await db
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

  // Run background/credit screening (non-blocking; errors do not fail the submission)
  try {
    const { runScreening } = await import("../../../lib/runScreening");
    const screenData = await runScreening({
      firstName: data.firstName as string,
      lastName: data.lastName as string,
      dob: data.dob as string
    });
    await db
      .from("applications")
      .update({
        credit_score: screenData.credit_score ?? null,
        background_result: { evictions: screenData.evictions, criminal_record: screenData.criminal_record }
      })
      .eq("id", appId);
  } catch (e) {
    console.error("Screening follow-up error", e);
  }

  // Send confirmation email (non-blocking; errors do not fail the submission)
  try {
    const { sendApplicationReceived } = await import("../../../lib/email");
    await sendApplicationReceived(data.email as string, appId);
  } catch (e) {
    console.error("Application email error", e);
  }

  return json({ success: true, applicationId: appId });
}
