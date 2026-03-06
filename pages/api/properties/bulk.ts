import type { NextApiRequest, NextApiResponse } from "next";
import { getLandlordOrAdmin, getAdminClient } from "../../../lib/apiAuth";

export const runtime = "edge";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  let landlordId: string | null = null;
  if (auth.role === "landlord") {
    landlordId = auth.landlordId;
  } else if (auth.role === "admin" && (req.body as Record<string, unknown>)?.landlordId) {
    landlordId = String((req.body as Record<string, unknown>).landlordId);
  }
  if (!landlordId) {
    return res.status(400).json({ error: "A landlord is required for these properties." });
  }

  const body = req.body ?? {};
  const raw = (body as { properties?: unknown }).properties;
  if (!Array.isArray(raw)) {
    return res.status(400).json({ error: "Request body must include a 'properties' array." });
  }

  const toInsert: ValidRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = validateRow(raw[i] as PropertyInput, i);
    if (result.ok) toInsert.push(result.data);
    else errors.push(result.error);
  }

  let inserted = 0;
  if (toInsert.length > 0) {
    const supabase = getAdminClient();
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
      return res.status(500).json({ inserted: 0, errors: [...errors, error.message] });
    }
    inserted = data?.length ?? 0;
  }

  return res.status(200).json({ inserted, errors });
}
