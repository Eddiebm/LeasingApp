import { getAdminClient } from "../../../lib/apiAuth";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { isProSubscriber, FREE_PROPERTY_LIMIT } from "../../../lib/subscription";

export const runtime = "edge";

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
    })
    .select("id, address, city, state, zip, rent")
    .single();

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  return json(data, 201);
}

