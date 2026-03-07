import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { photo_url?: string; property_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const photoUrl = typeof body.photo_url === "string" ? body.photo_url.trim() : "";
  const propertyId = typeof body.property_id === "string" ? body.property_id.trim() : "";

  if (!photoUrl || !propertyId) {
    return json({ error: "Missing photo_url or property_id." }, 400);
  }

  const db = getAdminClient();
  const { data: property, error: propError } = await db
    .from("properties")
    .select("id, landlord_id, photos")
    .eq("id", propertyId)
    .maybeSingle();

  if (propError || !property) {
    return json({ error: "Property not found." }, 404);
  }
  const row = property as { landlord_id: string; photos: string[] | null };
  if (auth.role === "landlord" && row.landlord_id !== auth.landlordId) {
    return json({ error: "Forbidden." }, 403);
  }

  const currentPhotos: string[] = Array.isArray(row.photos) ? row.photos : [];
  const newPhotos = currentPhotos.filter((url) => url !== photoUrl);
  if (newPhotos.length === currentPhotos.length) {
    return json({ error: "Photo not found on this property." }, 404);
  }

  // Extract path from public URL (bucket is property-photos)
  try {
    const u = new URL(photoUrl);
    const pathMatch = u.pathname.match(/\/storage\/v1\/object\/public\/property-photos\/(.+)/);
    const path = pathMatch ? pathMatch[1] : null;
    if (path) {
      const supabase = getSupabaseServer();
      await supabase.storage.from("property-photos").remove([path]);
    }
  } catch {
    // Ignore URL parse/storage errors; still update DB
  }

  const { error: updateError } = await db
    .from("properties")
    .update({ photos: newPhotos })
    .eq("id", propertyId);

  if (updateError) {
    console.error(updateError);
    return json({ error: "Failed to update property." }, 500);
  }

  return json({ success: true, photos: newPhotos }, 200);
}
