import { getAdminClient } from "../../../lib/apiAuth";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { isProSubscriber, FREE_PROPERTY_LIMIT } from "../../../lib/subscription";

export const runtime = "edge";

/*
  Migration: add to properties table if not present:
  - photos TEXT[] DEFAULT '{}'
  - description TEXT
  - available_from DATE
  - pets_allowed TEXT
  - furnished BOOLEAN DEFAULT false
  - parking BOOLEAN DEFAULT false
  - amenities TEXT[] DEFAULT '{}'
*/

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);


  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const state = String(body.state ?? "").trim();
  const zip = String(body.zip ?? "").trim();
  const rentValue = body.rent;

  if (!address || !city || !state || !zip) {
    return json({ error: "Address, city, state, and zip are required." }, 400);
  }

  const rent =
    typeof rentValue === "number"
      ? rentValue
      : rentValue
      ? parseFloat(String(rentValue).replace(/[^0-9.]/g, ""))
      : null;

  if (rent == null || Number.isNaN(rent)) {
    return json({ error: "Rent must be a valid number." }, 400);
  }

  let landlordId: string | null = null;
  if (auth.role === "landlord") {
    landlordId = auth.landlordId;
  } else if (auth.role === "admin" && body.landlordId) {
    landlordId = String(body.landlordId);
  }

  if (!landlordId) {
    return json({ error: "A landlord is required for this property." }, 400);
  }

  const db = getAdminClient();
  if (auth.role === "landlord") {
    const { count } = await db
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("landlord_id", landlordId);
    const { data: landlordRow } = await db
      .from("landlords")
      .select("subscription_status")
      .eq("id", landlordId)
      .single();
    const isPro = isProSubscriber(landlordRow?.subscription_status);
    if (!isPro && (count ?? 0) >= FREE_PROPERTY_LIMIT) {
      return json(
        { error: "Free plan limit reached. Upgrade to Pro to add unlimited properties." },
        403
      );
    }
  }

  const photos = Array.isArray(body.photos) ? body.photos.filter((u): u is string => typeof u === "string") : [];
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) : null;
  const availableFrom = typeof body.available_from === "string" && body.available_from.trim() ? body.available_from.trim() : null;
  const petsAllowed = typeof body.pets_allowed === "string" && ["yes", "no", "negotiable"].includes(body.pets_allowed) ? body.pets_allowed : null;
  const furnished = body.furnished === true || body.furnished === "true";
  const parking = body.parking === true || body.parking === "true";
  const amenities = Array.isArray(body.amenities) ? body.amenities.filter((a): a is string => typeof a === "string") : [];

  const { data, error } = await db
    .from("properties")
    .insert({
      landlord_id: landlordId,
      address,
      city,
      state,
      zip,
      rent,
      status: "active",
      photos: photos.length ? photos : undefined,
      description: description || undefined,
      available_from: availableFrom || undefined,
      pets_allowed: petsAllowed || undefined,
      furnished: furnished || undefined,
      parking: parking || undefined,
      amenities: amenities.length ? amenities : undefined,
    })
    .select("id, address, city, state, zip, rent")
    .single();

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  // Phase 2: Trigger async ownership check (fire-and-forget, non-blocking)
  if (data?.id) {
    const origin = new URL(req.url).origin;
    fetch(`${origin}/api/properties/ownership-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: req.headers.get("Authorization") || "",
      },
      body: JSON.stringify({ propertyId: data.id }),
    }).catch(() => { /* non-blocking */ });
  }

  return json(data, 201);
}

