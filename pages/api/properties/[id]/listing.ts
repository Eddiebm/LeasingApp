import { getLandlordOrAdmin, getAdminClient } from "../../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").slice(-2, -1)[0];
  if (!id) return json({ error: "Missing property id" }, 400);

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = getAdminClient();

  if (req.method === "GET") {
    const { data, error } = await db
      .from("properties")
      .select("id, landlord_id, is_listed, listing_headline, listing_description, listing_photo_url, bedrooms, bathrooms, available_from, listing_slug, rent, address, city, state, zip")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return json({ error: "Property not found" }, 404);
    if (auth.role === "landlord" && (data as { landlord_id: string }).landlord_id !== auth.landlordId) {
      return json({ error: "Forbidden" }, 403);
    }
    return json(data, 200);
  }

  if (req.method === "POST") {
    const { data: existing, error } = await db
      .from("properties")
      .select("id, landlord_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !existing) return json({ error: "Property not found" }, 404);
    if (auth.role === "landlord" && (existing as { landlord_id: string }).landlord_id !== auth.landlordId) {
      return json({ error: "Forbidden" }, 403);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const payload: Record<string, unknown> = {};
    if (typeof body.listing_headline === "string") payload.listing_headline = body.listing_headline.trim();
    if (typeof body.listing_description === "string") payload.listing_description = body.listing_description;
    if (body.bedrooms != null) payload.bedrooms = Number(body.bedrooms) || null;
    if (body.bathrooms != null) payload.bathrooms = Number(body.bathrooms) || null;
    if (typeof body.available_from === "string") payload.available_from = body.available_from || null;

    const { error: updateError } = await db.from("properties").update(payload).eq("id", id);
    if (updateError) {
      console.error(updateError);
      return json({ error: "Failed to save listing." }, 500);
    }
    return json({ success: true }, 200);
  }

  return new Response(null, { status: 405 });
}

