import { getLandlordOrAdmin, getAdminClient } from "../../../../lib/apiAuth";

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

  const db = getAdminClient();
  const { data: property, error } = await db
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

  const { error: updateError } = await db
    .from("properties")
    .update({ is_listed: false })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return json({ error: "Failed to unpublish listing." }, 500);
  }

  return json({ success: true }, 200);
}

