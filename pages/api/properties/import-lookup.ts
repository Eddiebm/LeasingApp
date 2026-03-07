import { getLandlordOrAdmin } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Detect if input looks like a UK postcode
function isUkPostcode(input: string): boolean {
  const cleaned = input.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/.test(cleaned);
}

// Detect if input looks like a US address (has state abbreviation or ZIP)
function isUsAddress(input: string): boolean {
  // Has a 5-digit ZIP code
  if (/\b\d{5}(-\d{4})?\b/.test(input)) return true;
  // Has a US state abbreviation pattern like ", TX" or ", CA"
  if (/,\s*[A-Z]{2}\b/.test(input)) return true;
  return false;
}

interface RentcastProperty {
  formattedAddress?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
  features?: {
    garage?: boolean;
    pool?: boolean;
    cooling?: boolean;
    heating?: boolean;
    floorCount?: number;
    unitCount?: number;
  };
}

interface RentcastRentEstimate {
  rent?: number;
  rentRangeLow?: number;
  rentRangeHigh?: number;
}

interface PostcodesIoResult {
  postcode?: string;
  admin_district?: string;
  admin_county?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim() || url.searchParams.get("address")?.trim();

  if (!query) {
    return json({ error: "q query parameter is required" }, 400);
  }

  // Get Rentcast API key
  const env = (req as unknown as { env?: Record<string, string> }).env ?? {};
  const rentcastKey =
    env.RENTCAST_API_KEY ||
    (typeof process !== "undefined" ? process.env.RENTCAST_API_KEY : "") ||
    "57fdd1a7bd9a473da9da5f4740f31c2a";

  // Route to correct handler based on input type
  if (isUkPostcode(query)) {
    return handleUkPostcode(query);
  } else if (isUsAddress(query)) {
    return handleUsAddress(query, rentcastKey);
  } else {
    // Try US first, fall back to UK postcode check
    return handleUsAddress(query, rentcastKey);
  }
}

async function handleUkPostcode(postcode: string) {
  try {
    const cleaned = postcode.replace(/\s+/g, "").toUpperCase();
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`);

    if (!res.ok) {
      if (res.status === 404) {
        return json({ error: "Postcode not found. Please check the postcode and try again." }, 404);
      }
      return json({ error: "Could not look up postcode. Please try again." }, 502);
    }

    const data = await res.json() as { result?: PostcodesIoResult };
    const r = data.result;

    if (!r) {
      return json({ error: "No data found for that postcode." }, 404);
    }

    return new Response(JSON.stringify({
      region: "uk",
      postcode: r.postcode,
      city: r.admin_district ?? r.region ?? "",
      county: r.admin_county ?? r.region ?? "",
      state: r.country ?? "England",
      country: r.country,
      latitude: r.latitude ?? null,
      longitude: r.longitude ?? null,
      // UK: address fields need manual entry
      address: null,
      zip: r.postcode,
      bedrooms: null,
      bathrooms: null,
      squareFootage: null,
      yearBuilt: null,
      propertyType: null,
      rentEstimate: null,
      rentRangeLow: null,
      rentRangeHigh: null,
      // Signal to frontend that address line needs manual entry
      requiresManualAddress: true,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("UK postcode lookup error:", err);
    return new Response(JSON.stringify({ error: "Failed to look up postcode. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleUsAddress(address: string, rentcastKey: string) {
  try {
    const propertyRes = await fetch(
      `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          accept: "application/json",
          "X-Api-Key": rentcastKey,
        },
      }
    );

    if (!propertyRes.ok) {
      const errBody = await propertyRes.json().catch(() => ({})) as { message?: string };
      if (propertyRes.status === 401) {
        return new Response(JSON.stringify({
          error: "Property lookup service is temporarily unavailable. Please enter the address manually.",
          serviceUnavailable: true,
        }), { status: 503, headers: { "Content-Type": "application/json" } });
      }
      if (propertyRes.status === 404) {
        return new Response(JSON.stringify({
          error: "No property found at that address. Try the full address including city, state, and ZIP.",
        }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: errBody.message ?? "Failed to look up property" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const properties = await propertyRes.json() as RentcastProperty[];

    if (!properties || properties.length === 0) {
      return new Response(JSON.stringify({
        error: "No property found at that address. Try entering the full address including city, state, and ZIP.",
      }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const prop = properties[0];

    // Get rent estimate
    let rentEstimate: number | null = null;
    let rentRangeLow: number | null = null;
    let rentRangeHigh: number | null = null;

    try {
      const rentRes = await fetch(
        `https://api.rentcast.io/v1/avm/rent/long-term?address=${encodeURIComponent(prop.formattedAddress ?? address)}`,
        {
          headers: {
            accept: "application/json",
            "X-Api-Key": rentcastKey,
          },
        }
      );
      if (rentRes.ok) {
        const rentData = await rentRes.json() as RentcastRentEstimate;
        rentEstimate = rentData.rent ?? null;
        rentRangeLow = rentData.rentRangeLow ?? null;
        rentRangeHigh = rentData.rentRangeHigh ?? null;
      }
    } catch {
      // Rent estimate is optional
    }

    return new Response(JSON.stringify({
      region: "us",
      formattedAddress: prop.formattedAddress,
      address: prop.addressLine1,
      city: prop.city,
      state: prop.state,
      zip: prop.zipCode,
      county: prop.county,
      propertyType: prop.propertyType,
      bedrooms: prop.bedrooms ?? null,
      bathrooms: prop.bathrooms ?? null,
      squareFootage: prop.squareFootage ?? null,
      lotSize: prop.lotSize ?? null,
      yearBuilt: prop.yearBuilt ?? null,
      lastSalePrice: prop.lastSalePrice ?? null,
      lastSaleDate: prop.lastSaleDate ?? null,
      latitude: prop.latitude ?? null,
      longitude: prop.longitude ?? null,
      features: prop.features ?? null,
      rentEstimate,
      rentRangeLow,
      rentRangeHigh,
      requiresManualAddress: false,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("US property lookup error:", err);
    return new Response(JSON.stringify({ error: "Failed to look up property. Please try again or enter details manually." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
