import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const PAGE_SIZE = 12;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const city = url.searchParams.get("city")?.trim() || undefined;
  const minRent = url.searchParams.get("min_rent");
  const maxRent = url.searchParams.get("max_rent");
  const bedrooms = url.searchParams.get("bedrooms");
  const petsAllowed = url.searchParams.get("pets_allowed")?.toLowerCase() || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const db = getSupabaseServer();
  let query = db
    .from("properties")
    .select(
      "id, address, city, state, zip, rent, bedrooms, bathrooms, photos, description, available_from, pets_allowed, furnished, parking, amenities, landlords!inner(full_name, company_name, slug)",
      { count: "exact" }
    )
    .eq("is_listed", true)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (city) query = query.ilike("city", `%${city}%`);
  if (minRent != null && minRent !== "") {
    const n = parseFloat(minRent);
    if (!Number.isNaN(n)) query = query.gte("rent", n);
  }
  if (maxRent != null && maxRent !== "") {
    const n = parseFloat(maxRent);
    if (!Number.isNaN(n)) query = query.lte("rent", n);
  }
  if (bedrooms != null && bedrooms !== "") {
    const n = parseInt(bedrooms, 10);
    if (!Number.isNaN(n)) query = query.eq("bedrooms", n);
  }
  if (petsAllowed === "yes" || petsAllowed === "no" || petsAllowed === "negotiable") {
    query = query.eq("pets_allowed", petsAllowed);
  }

  const { data: rows, error, count } = await query;

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  const list = (rows ?? []).map((r: Record<string, unknown>) => {
    const ll = r.landlords as { full_name?: string; company_name?: string | null; slug?: string | null } | null;
    const landlordName = ll?.company_name || ll?.full_name || "Landlord";
    const landlordSlug = ll?.slug ?? null;
    const { landlords: _, ...rest } = r;
    return { ...rest, landlord_name: landlordName, landlord_slug: landlordSlug };
  });

  return json({
    rentals: list,
    total: count ?? 0,
    page,
    per_page: PAGE_SIZE,
    total_pages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
