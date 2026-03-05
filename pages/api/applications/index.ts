import { createClient } from "@supabase/supabase-js";
import { getRequestContext } from "@cloudflare/next-on-pages";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  // Read env vars inside the handler so edge runtime resolves them per-request
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://seedtvpyhmzskkdlnblg.supabase.co";
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    "sb_publishable_KUY0YWTlIfqPW20phruqiw_B75TXglU";
  // Use getRequestContext to access Cloudflare env vars that Next.js strips at build time
  let cfEnv: Record<string, string> = {};
  try { cfEnv = (getRequestContext().env as Record<string, string>); } catch { /* not in CF runtime */ }
  const SUPABASE_SERVICE_KEY = cfEnv.SUPABASE_SERVICE_ROLE_KEY ||
    cfEnv.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  const url = new URL(req.url);

  if (req.method === "GET") {
    // Use the user's own token to query — Supabase validates it automatically
    const authHeader = req.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return json({ error: "Unauthorized" }, 401);

    // Create a client scoped to the user's token
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the token is valid by getting the user
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const propertyId = url.searchParams.get("propertyId") ?? undefined;

    // Use service key client for the actual data query (bypasses RLS for admin dashboard)
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    let q = adminClient
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

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

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

  // Run background/credit screening (non-blocking)
  try {
    const { runScreening } = await import("../../../lib/runScreening");
    const screenData = await runScreening({
      firstName: data.firstName as string,
      lastName: data.lastName as string,
      dob: data.dob as string
    });
    await adminClient
      .from("applications")
      .update({
        credit_score: screenData.credit_score ?? null,
        background_result: { evictions: screenData.evictions, criminal_record: screenData.criminal_record }
      })
      .eq("id", appId);
  } catch (e) {
    console.error("Screening follow-up error", e);
  }

  // Send confirmation email (non-blocking)
  try {
    const { sendApplicationReceived } = await import("../../../lib/email");
    await sendApplicationReceived(data.email as string, appId);
  } catch (e) {
    console.error("Application email error", e);
  }

  return json({ success: true, applicationId: appId });
}
