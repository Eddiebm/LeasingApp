import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";
import { isProSubscriber, FREE_PROPERTY_LIMIT } from "../../../lib/subscription";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type PropertyInput = {
  address?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
  rent?: unknown;
  status?: unknown;
  application_deadline?: unknown;
};

type ValidRow = {
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number;
  status: "active" | "inactive";
  application_deadline: string | null;
};

function validateRow(row: PropertyInput, index: number): { ok: true; data: ValidRow } | { ok: false; error: string } {
  const address = String(row.address ?? "").trim();
  const city = String(row.city ?? "").trim();
  const state = String(row.state ?? "").trim();
  const zip = String(row.zip ?? "").trim();
  const rentValue = row.rent;
  const statusRaw = String(row.status ?? "").trim().toLowerCase() || "active";
  const appDeadline = row.application_deadline != null ? String(row.application_deadline).trim() : "";

  if (!address) return { ok: false, error: `Row ${index + 1}: address is required.` };
  if (!city) return { ok: false, error: `Row ${index + 1}: city is required.` };
  if (!state) return { ok: false, error: `Row ${index + 1}: state is required.` };
  if (!zip) return { ok: false, error: `Row ${index + 1}: zip is required.` };

  const rent =
    typeof rentValue === "number"
      ? rentValue
      : rentValue != null
        ? parseFloat(String(rentValue).replace(/[^0-9.]/g, ""))
        : NaN;
  if (Number.isNaN(rent) || rent < 0) {
    return { ok: false, error: `Row ${index + 1}: rent must be a valid number.` };
  }

  if (statusRaw !== "active" && statusRaw !== "inactive") {
    return { ok: false, error: `Row ${index + 1}: status must be "active" or "inactive".` };
  }
  const status = statusRaw as "active" | "inactive";

  let application_deadline: string | null = null;
  if (appDeadline) {
    if (!ISO_DATE.test(appDeadline)) {
      return { ok: false, error: `Row ${index + 1}: application_deadline must be YYYY-MM-DD.` };
    }
    application_deadline = appDeadline;
  }

  return {
    ok: true,
    data: { address, city, state, zip, rent, status, application_deadline },
  };
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: { properties?: unknown; landlordId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  let landlordId: string | null = null;
  if (auth.role === "landlord") {
    landlordId = auth.landlordId;
  } else if (auth.role === "admin" && body.landlordId) {
    landlordId = String(body.landlordId);
  }
  if (!landlordId) {
    return json({ error: "A landlord is required for these properties." }, 400);
  }

  const raw = body.properties;
  if (!Array.isArray(raw)) {
    return json({ error: "Request body must include a 'properties' array." }, 400);
  }

  const toInsert: ValidRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = validateRow(raw[i] as PropertyInput, i);
    if (result.ok) toInsert.push(result.data);
    else errors.push(result.error);
  }

  const supabase = getAdminClient();
  if (auth.role === "landlord" && toInsert.length > 0) {
    const { count } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("landlord_id", landlordId);
    const { data: landlordRow } = await supabase
      .from("landlords")
      .select("subscription_status")
      .eq("id", landlordId)
      .single();
    const isPro = isProSubscriber(landlordRow?.subscription_status);
    const currentCount = count ?? 0;
    if (!isPro && currentCount + toInsert.length > FREE_PROPERTY_LIMIT) {
      return json(
        {
          error: "Free plan limit reached. Upgrade to Pro to add unlimited properties.",
          inserted: 0,
          errors,
        },
        403
      );
    }
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const rows = toInsert.map((p) => ({
      landlord_id: landlordId,
      address: p.address,
      city: p.city,
      state: p.state,
      zip: p.zip,
      rent: p.rent,
      status: p.status,
      application_deadline: p.application_deadline,
    }));
    const { data, error } = await supabase.from("properties").insert(rows).select("id");
    if (error) {
      console.error(error);
      return json({ inserted: 0, errors: [...errors, error.message] }, 500);
    }
    inserted = data?.length ?? 0;
  }

  return json({ inserted, errors }, 200);
}
