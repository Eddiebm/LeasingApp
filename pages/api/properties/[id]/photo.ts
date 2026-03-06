import { getLandlordOrAdmin, getAdminClient } from "../../../../lib/apiAuth";
import { getSupabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").slice(-2, -1)[0];
  if (!id) return json({ error: "Missing property id" }, 400);

  const auth = await getLandlordOrAdmin(req);
  if (!auth || (auth.role !== "landlord" && auth.role !== "admin")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = getAdminClient();
  const { data: property, error } = await admin
    .from("properties")
    .select("id, landlord_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !property) {
    return json({ error: "Property not found" }, 404);
  }

  if (auth.role === "landlord" && property.landlord_id !== auth.landlordId) {
    return json({ error: "Forbidden" }, 403);
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return json({ error: "Missing file" }, 400);

  if (!file.type.startsWith("image/")) {
    return json({ error: "Only image uploads are allowed." }, 400);
  }

  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return json({ error: "File too large (max 5MB)." }, 400);
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "jpg";
  const buffer = await file.arrayBuffer();
  const path = `${property.landlord_id ?? "shared"}/${id}-${Date.now()}.${ext}`;

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

  const { error: updateError } = await admin
    .from("properties")
    .update({ listing_photo_url: photoUrl })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return json({ error: "Failed to save photo URL." }, 500);
  }

  return json({ photoUrl }, 200);
}

