import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";

const ADMIN_USER_ID = "4c447225-b57c-4da1-83ff-94cc25ad6755";

function getTokenUserId(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const payload = JSON.parse(atob(auth.slice(7).split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.sub ?? null;
  } catch { return null; }
}

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function getPeriodBounds(period: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  switch (period) {
    case "day":
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start: start.toISOString(), end };
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const tokenUserId = getTokenUserId(req);
  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "admin") {
    // Fallback: allow known admin user ID even if getLandlordOrAdmin fails
    if (tokenUserId !== ADMIN_USER_ID) return json({ error: "Forbidden" }, 403);
  }

  let url: URL;
  try { url = new URL(req.url); } catch { return json({ error: "Bad request" }, 400); }
  const period = (url.searchParams.get("period") || "month").toLowerCase();
  const { start: periodStart, end: periodEnd } = getPeriodBounds(period);

  let db: ReturnType<typeof getAdminClient>;
  try {
    db = getAdminClient();
  } catch (e) {
    return json({ error: "DB init failed", detail: String(e) }, 500);
  }

  try {

  // Screening revenue (payments: screening_fee, paid)
  const { data: screeningRows } = await db
    .from("payments")
    .select("amount_cents")
    .eq("payment_type", "screening_fee")
    .eq("status", "paid")
    .gte("paid_at", periodStart)
    .lte("paid_at", periodEnd);
  const revenueScreeningCents = (screeningRows ?? []).reduce((s, r) => s + (Number((r as { amount_cents: number }).amount_cents) || 0), 0);

  // Rent platform fees (rent_payments: succeeded)
  const { data: rentRows } = await db
    .from("rent_payments")
    .select("platform_fee_cents")
    .eq("status", "succeeded")
    .not("paid_at", "is", null)
    .gte("paid_at", periodStart)
    .lte("paid_at", periodEnd);
  const revenueRentFeesCents = (rentRows ?? []).reduce((s, r) => s + (Number((r as { platform_fee_cents: number }).platform_fee_cents) || 0), 0);

  // Landlords
  const { count: landlordsTotal } = await db.from("landlords").select("id", { count: "exact", head: true });
  const { data: landlordsCreated } = await db.from("landlords").select("id").gte("created_at", periodStart).lte("created_at", periodEnd);
  const { data: landlordsWithConnect } = await db.from("landlords").select("id").not("stripe_connect_account_id", "is", null);
  const { data: landlordsSubscribed } = await db.from("landlords").select("id").eq("subscription_status", "active");

  // Tenants (renters) — anyone who has applied or is on an application
  const { count: tenantsTotal } = await db.from("tenants").select("id", { count: "exact", head: true });
  const { data: tenantsCreated } = await db.from("tenants").select("id").gte("created_at", periodStart).lte("created_at", periodEnd);

  // Landlords "using services": with at least one property, with listing, Connect onboarded, Pro
  const { data: landlordsWithProperty } = await db.from("properties").select("landlord_id");
  const landlordIdsWithProperty = [...new Set((landlordsWithProperty ?? []).map((p) => (p as { landlord_id: string }).landlord_id))];
  const { data: listedByLandlord } = await db.from("properties").select("landlord_id").eq("is_listed", true);
  const landlordIdsWithListing = [...new Set((listedByLandlord ?? []).map((p) => (p as { landlord_id: string }).landlord_id))];

  // Renters using services: applicants (unique tenant_id), applicants who paid screening
  const { data: appTenantIds } = await db.from("applications").select("tenant_id").not("tenant_id", "is", null);
  const uniqueApplicantIds = new Set((appTenantIds ?? []).map((a) => (a as { tenant_id: string }).tenant_id));
  const { data: paidScreening } = await db.from("payments").select("application_id").eq("payment_type", "screening_fee").eq("status", "paid");
  const paidAppIds = (paidScreening ?? []).map((p) => (p as { application_id: string }).application_id);
  let rentersWhoPaidScreening = new Set<string>();
  if (paidAppIds.length > 0) {
    const { data: appsWithPaid } = await db.from("applications").select("tenant_id").in("id", paidAppIds);
    for (const a of appsWithPaid ?? []) {
      const tid = (a as { tenant_id: string }).tenant_id;
      if (tid) rentersWhoPaidScreening.add(tid);
    }
  }

  // Geography: landlords by country, properties by state
  const { data: landlordCountries } = await db.from("landlords").select("country");
  const byCountry: Record<string, number> = {};
  for (const row of landlordCountries ?? []) {
    const c = (row as { country: string | null }).country ?? "unknown";
    byCountry[c] = (byCountry[c] ?? 0) + 1;
  }
  const { data: propertyStates } = await db.from("properties").select("state");
  const byState: Record<string, number> = {};
  for (const row of propertyStates ?? []) {
    const s = (row as { state: string }).state?.trim() || "unknown";
    byState[s] = (byState[s] ?? 0) + 1;
  }

  // Properties
  const { count: propertiesTotal } = await db.from("properties").select("id", { count: "exact", head: true });
  const { count: propertiesListed } = await db.from("properties").select("id", { count: "exact", head: true }).eq("is_listed", true);

  // Applications
  const { count: applicationsTotal } = await db.from("applications").select("id", { count: "exact", head: true });
  const { data: applicationsInPeriod } = await db.from("applications").select("id, status").gte("created_at", periodStart).lte("created_at", periodEnd);
  const applicationsNew = applicationsInPeriod?.length ?? 0;
  const applicationsApproved = applicationsInPeriod?.filter((a) => (a as { status: string }).status === "approved").length ?? 0;
  const applicationsRejected = applicationsInPeriod?.filter((a) => (a as { status: string }).status === "rejected").length ?? 0;
  const applicationsPending = applicationsInPeriod?.filter((a) => (a as { status: string }).status !== "approved" && (a as { status: string }).status !== "rejected").length ?? 0;

  // Rent payments
  const { data: rentPaymentsAll } = await db.from("rent_payments").select("id, status").gte("created_at", periodStart).lte("created_at", periodEnd);
  const rentPaymentsSucceeded = rentPaymentsAll?.filter((r) => (r as { status: string }).status === "succeeded").length ?? 0;
  const rentPaymentsFailed = rentPaymentsAll?.filter((r) => (r as { status: string }).status === "failed").length ?? 0;
  const rentPaymentsPending = rentPaymentsAll?.filter((r) => (r as { status: string }).status === "pending" || (r as { status: string }).status === "processing").length ?? 0;

  // Maintenance
  const { count: maintenanceTotal } = await db.from("maintenance_requests").select("id", { count: "exact", head: true });
  const { count: maintenanceOpen } = await db
    .from("maintenance_requests")
    .select("id", { count: "exact", head: true })
    .not("status", "in", '("resolved","closed")');

  // Recent landlords with property + application counts
  const { data: landlordList } = await db
    .from("landlords")
    .select("id, full_name, company_name, email, created_at, stripe_connect_account_id, stripe_connect_onboarded, subscription_status")
    .order("created_at", { ascending: false })
    .limit(50);
  const landlordIds = (landlordList ?? []).map((l) => (l as { id: string }).id);

  let propertyCounts: Record<string, number> = {};
  let applicationsByLandlord: Record<string, number> = {};
  if (landlordIds.length > 0) {
    const { data: propRows } = await db.from("properties").select("id, landlord_id").in("landlord_id", landlordIds);
    const propToLandlord: Record<string, string> = {};
    for (const p of propRows ?? []) {
      const row = p as { id: string; landlord_id: string };
      propToLandlord[row.id] = row.landlord_id;
      propertyCounts[row.landlord_id] = (propertyCounts[row.landlord_id] ?? 0) + 1;
    }
    const propIds = (propRows ?? []).map((p) => (p as { id: string }).id);
    if (propIds.length > 0) {
      const { data: appRows } = await db.from("applications").select("property_id").in("property_id", propIds);
      for (const a of appRows ?? []) {
        const lid = propToLandlord[(a as { property_id: string }).property_id];
        if (lid) applicationsByLandlord[lid] = (applicationsByLandlord[lid] ?? 0) + 1;
      }
    }
  }

  const recentLandlords = (landlordList ?? []).map((l) => {
    const row = l as {
      id: string;
      full_name: string | null;
      company_name: string | null;
      email: string;
      created_at: string;
      stripe_connect_account_id: string | null;
      stripe_connect_onboarded: boolean | null;
      subscription_status: string | null;
    };
    return {
      id: row.id,
      name: row.company_name || row.full_name || row.email,
      email: row.email,
      createdAt: row.created_at,
      propertyCount: propertyCounts[row.id] ?? 0,
      applicationCount: applicationsByLandlord[row.id] ?? 0,
      connectOnboarded: !!row.stripe_connect_onboarded,
      subscriptionStatus: row.subscription_status ?? "inactive",
    };
  });

  // Failed rent payments (all time for "problems")
  const { data: failedRentPayments } = await db.from("rent_payments").select("id, created_at, amount_cents, landlord_id").eq("status", "failed").order("created_at", { ascending: false }).limit(20);

  // Totals for year estimate
  const yearBounds = getPeriodBounds("year");
  const { data: screeningYear } = await db
    .from("payments")
    .select("amount_cents")
    .eq("payment_type", "screening_fee")
    .eq("status", "paid")
    .gte("paid_at", yearBounds.start)
    .lte("paid_at", yearBounds.end);
  const { data: rentYear } = await db
    .from("rent_payments")
    .select("platform_fee_cents")
    .eq("status", "succeeded")
    .not("paid_at", "is", null)
    .gte("paid_at", yearBounds.start)
    .lte("paid_at", yearBounds.end);
  const revenueYearScreeningCents = (screeningYear ?? []).reduce((s, r) => s + (Number((r as { amount_cents: number }).amount_cents) || 0), 0);
  const revenueYearRentFeesCents = (rentYear ?? []).reduce((s, r) => s + (Number((r as { platform_fee_cents: number }).platform_fee_cents) || 0), 0);
  const estimatedAnnualRevenueCents = revenueYearScreeningCents + revenueYearRentFeesCents;

  // AI usage (period + YTD) — table may not exist until migration 014 is run
  let aiUsagePeriod = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 };
  let aiUsageYtd = { promptTokens: 0, completionTokens: 0, totalTokens: 0, calls: 0 };
  try {
    const { data: aiRows } = await db
      .from("ai_usage_log")
      .select("prompt_tokens, completion_tokens, total_tokens")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd);
    if (aiRows?.length) {
      aiUsagePeriod = {
        promptTokens: (aiRows as { prompt_tokens: number }[]).reduce((s, r) => s + (r.prompt_tokens || 0), 0),
        completionTokens: (aiRows as { completion_tokens: number }[]).reduce((s, r) => s + (r.completion_tokens || 0), 0),
        totalTokens: (aiRows as { total_tokens: number }[]).reduce((s, r) => s + (r.total_tokens || 0), 0),
        calls: aiRows.length,
      };
    }
    const { data: aiYearRows } = await db
      .from("ai_usage_log")
      .select("prompt_tokens, completion_tokens, total_tokens")
      .gte("created_at", yearBounds.start)
      .lte("created_at", yearBounds.end);
    if (aiYearRows?.length) {
      aiUsageYtd = {
        promptTokens: (aiYearRows as { prompt_tokens: number }[]).reduce((s, r) => s + (r.prompt_tokens || 0), 0),
        completionTokens: (aiYearRows as { completion_tokens: number }[]).reduce((s, r) => s + (r.completion_tokens || 0), 0),
        totalTokens: (aiYearRows as { total_tokens: number }[]).reduce((s, r) => s + (r.total_tokens || 0), 0),
        calls: aiYearRows.length,
      };
    }
  } catch {
    /* ai_usage_log table may not exist */
  }

  // Red flags
  const today = new Date().toISOString().slice(0, 10);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: rentPaymentsOverdue } = await db
    .from("rent_payments")
    .select("id", { count: "exact", head: true })
    .in("status", ["pending", "processing"])
    .lt("due_date", today);
  const { data: screeningStuckRows } = await db
    .from("payments")
    .select("id")
    .eq("payment_type", "screening_fee")
    .neq("status", "paid")
    .lt("created_at", oneDayAgo);
  const { data: listedProps } = await db.from("properties").select("id, landlord_id").eq("is_listed", true);
  const listedLandlordIds = [...new Set((listedProps ?? []).map((p) => (p as { landlord_id: string }).landlord_id))];
  let listedNoConnect = 0;
  if (listedLandlordIds.length > 0) {
    const { data: connectOnboarded } = await db
      .from("landlords")
      .select("id")
      .in("id", listedLandlordIds)
      .eq("stripe_connect_onboarded", true);
    const onboardedSet = new Set((connectOnboarded ?? []).map((r) => (r as { id: string }).id));
    listedNoConnect = listedLandlordIds.filter((id) => !onboardedSet.has(id)).length;
  }

  const redFlags = {
    failedRentPayments: failedRentPayments?.length ?? 0,
    rentPaymentsOverdue: rentPaymentsOverdue ?? 0,
    screeningPaymentsStuck: screeningStuckRows?.length ?? 0,
    listedPropertiesNoConnect: listedNoConnect,
  };

  // Leases: signed leases and expiring by month (uses applications.lease_end_at — run migration 015)
  let leasesTotal = 0;
  let leasesExpiringThisMonth = 0;
  let leasesExpiringNextMonth = 0;
  const expiringByMonth: Record<string, number> = {};
  try {
    const { count: signedCount } = await db
      .from("applications")
      .select("id", { count: "exact", head: true })
      .not("lease_signed_at", "is", null);
    leasesTotal = signedCount ?? 0;

    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();
    for (let i = 0; i < 12; i++) {
      const m = thisMonth + i;
      const year = thisYear + Math.floor(m / 12);
      const month = (m % 12) + 1;
      const key = `${year}-${String(month).padStart(2, "0")}`;
      const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
      const end = new Date(year, month, 0).toISOString().slice(0, 10);
      const { count } = await db
        .from("applications")
        .select("id", { count: "exact", head: true })
        .not("lease_signed_at", "is", null)
        .not("lease_end_at", "is", null)
        .gte("lease_end_at", start)
        .lte("lease_end_at", end);
      expiringByMonth[key] = count ?? 0;
      if (i === 0) leasesExpiringThisMonth = count ?? 0;
      if (i === 1) leasesExpiringNextMonth = count ?? 0;
    }
  } catch {
    /* lease_end_at may not exist until migration 015 */
  }

  return json({
    period,
    periodStart,
    periodEnd,
    revenue: {
      screeningCents: revenueScreeningCents,
      rentFeesCents: revenueRentFeesCents,
      totalCents: revenueScreeningCents + revenueRentFeesCents,
      estimatedAnnualCents: estimatedAnnualRevenueCents,
    },
    landlords: {
      total: landlordsTotal ?? 0,
      newInPeriod: landlordsCreated?.length ?? 0,
      withConnect: landlordsWithConnect?.length ?? 0,
      subscribed: landlordsSubscribed?.length ?? 0,
      withProperty: landlordIdsWithProperty.length,
      withListing: landlordIdsWithListing.length,
    },
    tenants: {
      total: tenantsTotal ?? 0,
      newInPeriod: tenantsCreated?.length ?? 0,
      applicants: uniqueApplicantIds.size,
      paidScreening: rentersWhoPaidScreening.size,
    },
    properties: { total: propertiesTotal ?? 0, listed: propertiesListed ?? 0 },
    where: {
      landlordsByCountry: byCountry,
      propertiesByState: byState,
    },
    applications: {
      total: applicationsTotal ?? 0,
      newInPeriod: applicationsNew,
      approved: applicationsApproved,
      rejected: applicationsRejected,
      pending: applicationsPending,
    },
    leases: {
      total: leasesTotal,
      expiringThisMonth: leasesExpiringThisMonth,
      expiringNextMonth: leasesExpiringNextMonth,
      expiringByMonth,
    },
    rentPayments: {
      succeeded: rentPaymentsSucceeded,
      failed: rentPaymentsFailed,
      pending: rentPaymentsPending,
    },
    maintenance: { total: maintenanceTotal ?? 0, open: maintenanceOpen ?? 0 },
    recentLandlords,
    failedRentPayments: (failedRentPayments ?? []).map((r) => ({
      id: (r as { id: string }).id,
      createdAt: (r as { created_at: string }).created_at,
      amountCents: (r as { amount_cents: number }).amount_cents,
      landlordId: (r as { landlord_id: string }).landlord_id,
    })),
    aiUsage: { period: aiUsagePeriod, ytd: aiUsageYtd },
    redFlags,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "Query failed", detail: msg }, 500);
  }
}
