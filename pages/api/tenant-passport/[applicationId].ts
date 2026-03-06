import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

type PassportSummary = {
  tenantId: string;
  passportId: string | null;
  identityVerified: boolean | null;
  creditScore: number | null;
  incomeVerified: boolean | null;
  evictionHistory: string | null;
  criminalRecords: string | null;
  rightToRent: string | null;
  screeningProvider: string | null;
  passportExpiryDate: string | null;
};

export default async function handler(req: Request) {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const applicationId = pathSegments[pathSegments.length - 1] ?? "";
  if (!applicationId.trim()) {
    return json({ error: "applicationId required" }, 400);
  }

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = getAdminClient();

  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, tenant_id, properties ( landlord_id )")
    .eq("id", applicationId.trim())
    .single();

  if (appError || !app) {
    return json({ error: "Application not found" }, 404);
  }

  const a = app as {
    id: string;
    tenant_id: string | null;
    properties: { landlord_id: string | null } | null;
  };

  if (auth.role === "landlord") {
    const landlordId = auth.landlord?.id ?? null;
    const appLandlordId = a.properties?.landlord_id ?? null;
    if (!landlordId || !appLandlordId || landlordId !== appLandlordId) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  const tenantId = a.tenant_id;
  if (!tenantId) {
    return json({ error: "No tenant linked to this application" }, 404);
  }

  const nowIso = new Date().toISOString();
  const { data: passport } = await supabase
    .from("tenant_passports")
    .select("id, identity_verified, credit_score, income_verified, eviction_history, criminal_records, right_to_rent, screening_provider, passport_expiry_date")
    .eq("tenant_id", tenantId)
    .gt("passport_expiry_date", nowIso)
    .order("passport_expiry_date", { ascending: false })
    .maybeSingle();

  const p =
    (passport as {
      id: string;
      identity_verified: boolean | null;
      credit_score: number | null;
      income_verified: boolean | null;
      eviction_history: string | null;
      criminal_records: string | null;
      right_to_rent: string | null;
      screening_provider: string | null;
      passport_expiry_date: string | null;
    } | null) ?? null;

  const summary: PassportSummary = {
    tenantId,
    passportId: p?.id ?? null,
    identityVerified: p?.identity_verified ?? null,
    creditScore: p?.credit_score ?? null,
    incomeVerified: p?.income_verified ?? null,
    evictionHistory: p?.eviction_history ?? null,
    criminalRecords: p?.criminal_records ?? null,
    rightToRent: p?.right_to_rent ?? null,
    screeningProvider: p?.screening_provider ?? null,
    passportExpiryDate: p?.passport_expiry_date ?? null
  };

  return json({ passport: summary });
}
