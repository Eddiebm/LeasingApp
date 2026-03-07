import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const formData = await req.formData();
  const file = formData.get("photo") as File | null;
  const propertyId = formData.get("property_id") as string | null;

  if (!file || !propertyId?.trim()) {
    return json({ error: "Missing photo file or property_id." }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return json({ error: "Only JPG, PNG, and WEBP images are allowed." }, 400);
  }
  if (file.size > MAX_SIZE) {
    return json({ error: "File too large (max 5MB)." }, 400);
  }

  const db = getAdminClient();
  const { data: property, error: propError } = await db
    .from("properties")
    .select("id, landlord_id, photos")
    .eq("id", propertyId.trim())
    .maybeSingle();

  if (propError || !property) {
    return json({ error: "Property not found." }, 404);
  }
  const row = property as { landlord_id: string; photos: string[] | null };
  if (auth.role === "landlord" && row.landlord_id !== auth.landlordId) {
    return json({ error: "Forbidden." }, 403);
  }

  const currentPhotos: string[] = Array.isArray(row.photos) ? row.photos : [];
  if (currentPhotos.length >= 10) {
    return json({ error: "Maximum 10 photos per property." }, 400);
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${row.landlord_id}/${propertyId}-${Date.now()}.${ext}`;
  const buffer = await file.arrayBuffer();

  const supabase = getSupabaseServer();
  const { error: uploadError } = await supabase.storage
    .from("property-photos")
    .upload(path, new Uint8Array(buffer), {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error(uploadError);
    return json({ error: "Failed to upload image." }, 500);
  }

  const { data: urlData } = supabase.storage.from("property-photos").getPublicUrl(path);
  const photoUrl = urlData.publicUrl;

  const newPhotos = [...currentPhotos, photoUrl];
  const { error: updateError } = await db
    .from("properties")
    .update({ photos: newPhotos })
    .eq("id", propertyId.trim());

  if (updateError) {
    console.error(updateError);
    return json({ error: "Failed to save photo URL." }, 500);
  }

  return json({ photo_url: photoUrl, photos: newPhotos }, 200);
}
