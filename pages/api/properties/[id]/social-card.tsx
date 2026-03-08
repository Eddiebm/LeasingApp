import { ImageResponse } from "next/og";
import { getSupabaseServer } from "../../../../lib/supabaseServer";

export const runtime = "edge";

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const id = url.pathname.split("/").slice(-2, -1)[0];
  if (!id) return new Response("Missing property id", { status: 400 });

  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("properties")
    .select("address, city, state, zip, rent, listing_headline, bedrooms, bathrooms, listing_photo_url")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return new Response("Not found", { status: 404 });
  }

  const prop = data as {
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    rent: number | null;
    listing_headline: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    listing_photo_url: string | null;
  };

  const price = prop.rent != null ? `$${prop.rent.toLocaleString()}/month` : "";
  const bedsBaths =
    prop.bedrooms || prop.bathrooms
      ? `${prop.bedrooms ?? "—"} bed · ${prop.bathrooms ?? "—"} bath`
      : "";
  const addressLine = [prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(", ");
  const headline = prop.listing_headline || addressLine || "Rental listing";

  const listingPath = addressLine
    ? addressLine.toLowerCase().replace(/[,]/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "listing";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1080,
          height: 1080,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#020617",
          color: "white",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        <div
          style={{
            flex: 1,
            position: "relative",
            backgroundColor: "#1a3a2a",
            overflow: "hidden",
          }}
        >
          {prop.listing_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prop.listing_photo_url}
              alt={headline}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>
        <div
          style={{
            flex: 1,
            padding: "48px 64px 40px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            backgroundColor: "#020617",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 48, fontWeight: 700 }}>{price}</div>
            <div style={{ fontSize: 28, color: "#cbd5f5" }}>
              {bedsBaths}
            </div>
            <div style={{ fontSize: 24, color: "#9ca3af" }}>{addressLine}</div>
          </div>
          <div
            style={{
              fontSize: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              color: "#9ca3af",
            }}
          >
            <div>
              Apply at{" "}
              <span style={{ color: "#22c55e" }}>
                rentlease.app/listing/{listingPath}
              </span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>RentLease</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
    }
  );
}

