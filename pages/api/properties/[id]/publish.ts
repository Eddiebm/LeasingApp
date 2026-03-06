import { getLandlordOrAdmin, getAdminClient } from "../../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeBaseSlug(address: string): string {
  return address
    .toLowerCase()
    .replace(/[,]/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
    .select("id, landlord_id, address, listing_slug")
    .eq("id", id)
    .maybeSingle();

  if (error || !property) {
    return json({ error: "Property not found" }, 404);
  }

  if (auth.role === "landlord" && property.landlord_id !== auth.landlordId) {
    return json({ error: "Forbidden" }, 403);
  }

  const address = (property.address as string | null) ?? "";
  if (!address) return json({ error: "Property address is required to publish a listing." }, 400);

  let base = makeBaseSlug(address);
  if (!base) base = `property-${property.id}`;

  let slug = base;
  let suffix = 2;

  // If property already has a listing_slug, reuse it.
  if (property.listing_slug) {
    slug = property.listing_slug as string;
  } else {
    // ensure uniqueness
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: existing } = await db
        .from("properties")
        .select("id")
        .eq("listing_slug", slug)
        .maybeSingle();
      if (!existing || (existing as { id: string }).id === property.id) {
        break;
      }
      slug = `${base}-${suffix++}`;
    }
  }

  const { error: updateError } = await db
    .from("properties")
    .update({ is_listed: true, listing_slug: slug })
    .eq("id", id);

  if (updateError) {
    console.error(updateError);
    return json({ error: "Failed to publish listing." }, 500);
  }

  const listingUrl = `https://leasingapp.pages.dev/listing/${slug}`;
  return json({ listingUrl, slug }, 200);
}

