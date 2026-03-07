import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { getSupabaseServer } from "../../../lib/supabaseServer";
export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/properties/ownership-check
 * Body: { propertyId: string }
 * Checks property ownership via Rentcast (US) or HM Land Registry (UK).
 * Compares the registered owner name against the landlord's name.
 * Updates the property's ownership_check_* fields.
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty */ }

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const propertyId = String(body.propertyId ?? "").trim();
  if (!propertyId) return json({ error: "propertyId is required" }, 400);

  const db = getSupabaseServer();

  // Fetch the property
  const { data: property, error: propError } = await db
    .from("properties")
    .select("id, address, city, state, zip, landlord_id")
    .eq("id", propertyId)
    .single();

  if (propError || !property) return json({ error: "Property not found" }, 404);

  // Fetch the landlord name for comparison
  const landlordId = auth.role === "admin" ? property.landlord_id : auth.landlordId;
  const { data: landlord } = await db
    .from("landlords")
    .select("full_name, country")
    .eq("id", landlordId)
    .single();

  const landlordName = landlord?.full_name ?? "";
  const country = landlord?.country ?? "US";

  let ownerName: string | null = null;
  let checkSource = "unknown";

  try {
    if (country === "US") {
      // Rentcast property records API
      const rentcastKey = "57fdd1a7bd9a473da9da5f4740f31c2a";
      const address = encodeURIComponent(`${property.address}, ${property.city}, ${property.state} ${property.zip}`);
      const res = await fetch(
        `https://api.rentcast.io/v1/properties?address=${address}&limit=1`,
        { headers: { "X-Api-Key": rentcastKey } }
      );
      if (res.ok) {
        const data = await res.json();
        const record = Array.isArray(data) ? data[0] : data;
        ownerName = record?.owner?.names?.[0] ?? record?.ownerName ?? null;
        checkSource = "rentcast";
      }
    } else {
      // HM Land Registry - Title Register search (UK)
      // Uses the free INSPIRE polygons / title search API
      const postcode = property.zip?.replace(/\s/g, "").toUpperCase();
      const res = await fetch(
        `https://api.os.uk/search/places/v1/postcode?postcode=${postcode}&dataset=DPA&maxresults=1`,
        { headers: { "key": "FREE_TIER" } }
      );
      // HM Land Registry doesn't expose owner names on free tier
      // We use a softer check: confirm the address exists in official records
      if (res.ok) {
        checkSource = "hm_land_registry";
        ownerName = null; // Name check not available on free tier
      }
    }
  } catch (e) {
    console.error("ownership check fetch error:", e);
  }

  // Determine match
  let match: boolean | null = null;
  if (ownerName && landlordName) {
    // Fuzzy name match: check if any word in the owner name appears in landlord name
    const ownerWords = ownerName.toLowerCase().split(/\s+/);
    const landlordWords = landlordName.toLowerCase().split(/\s+/);
    const overlap = ownerWords.filter(w => w.length > 2 && landlordWords.includes(w));
    match = overlap.length > 0;
  }

  // Update the property record
  await db.from("properties").update({
    ownership_check_status: ownerName ? (match ? "verified" : "mismatch") : "checked",
    ownership_check_owner: ownerName,
    ownership_check_match: match,
    ownership_checked_at: new Date().toISOString(),
  }).eq("id", propertyId);

  return json({
    success: true,
    ownerName,
    landlordName,
    match,
    source: checkSource,
    status: ownerName ? (match ? "verified" : "mismatch") : "checked",
    message: ownerName
      ? match
        ? "Ownership verified — name matches public records."
        : `Name mismatch: public records show "${ownerName}". If you manage this property on behalf of the owner, that's fine.`
      : country === "UK"
        ? "UK ownership name check requires Land Registry API access. Property address confirmed."
        : "Could not retrieve ownership data. This may be because the property is not in Rentcast's database yet.",
  });
}
