import { getAdminClient } from "../../../lib/apiAuth";
import { isProSubscriber } from "../../../lib/subscription";

export const runtime = "edge";

const LIMIT = 10;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json([]);

  const supabase = getAdminClient();

  // Landlords whose slug matches (case-insensitive partial)
  const { data: landlordsBySlug } = await supabase
    .from("landlords")
    .select("id")
    .ilike("slug", `%${q}%`);
  const landlordIdsBySlug = (landlordsBySlug ?? []).map((r: { id: string }) => r.id);

  // Properties whose address matches (case-insensitive partial)
  const { data: propertiesByAddress } = await supabase
    .from("properties")
    .select("id, landlord_id")
    .ilike("address", `%${q}%`);
  const propertyIdsByAddress = (propertiesByAddress ?? []).map((p: { id: string }) => p.id);
  const landlordIdsByAddress = (propertiesByAddress ?? []).map((p: { landlord_id: string }) => p.landlord_id);

  const allLandlordIds = [...new Set([...landlordIdsBySlug, ...landlordIdsByAddress])];
  if (allLandlordIds.length === 0 && propertyIdsByAddress.length === 0) return json([]);

  // Fetch landlords with subscription for visibility
  const { data: landlords } = await supabase
    .from("landlords")
    .select("id, slug, full_name, subscription_status")
    .in("id", allLandlordIds.length ? allLandlordIds : ["never-match"]);
  const landlordMap = new Map(
    (landlords ?? []).map((l: { id: string; slug: string | null; full_name: string; subscription_status: string | null }) => [
      l.id,
      { slug: l.slug ?? "", fullName: l.full_name, isActive: isProSubscriber(l.subscription_status) }
    ])
  );

  // All candidate property ids: from address match OR from landlord slug match
  const candidatePropertyIds = new Set(propertyIdsByAddress);
  for (const lid of landlordIdsBySlug) {
    const { data: props } = await supabase.from("properties").select("id").eq("landlord_id", lid);
    (props ?? []).forEach((p: { id: string }) => candidatePropertyIds.add(p.id));
  }

  if (candidatePropertyIds.size === 0) return json([]);

  const { data: properties } = await supabase
    .from("properties")
    .select("id, address, city, state, zip, rent, bedrooms, landlord_id, is_listed")
    .in("id", Array.from(candidatePropertyIds))
    .limit(LIMIT * 2);

  const results: { landlordSlug: string; propertyId: string; address: string; landlordName: string; rent: number; bedrooms: number | null }[] = [];
  for (const p of properties ?? []) {
    const row = p as { id: string; address: string; city: string; state: string; zip: string; rent: number; bedrooms: number | null; landlord_id: string; is_listed: boolean | null };
    const meta = landlordMap.get(row.landlord_id);
    if (!meta) continue;
    const visible = row.is_listed === true || meta.isActive;
    if (!visible) continue;
    results.push({
      landlordSlug: meta.slug,
      propertyId: row.id,
      address: [row.address, row.city, row.state, row.zip].filter(Boolean).join(", "),
      landlordName: meta.fullName,
      rent: row.rent ?? 0,
      bedrooms: row.bedrooms ?? null
    });
    if (results.length >= LIMIT) break;
  }

  return json(results.slice(0, LIMIT));
}
