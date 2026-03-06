import type { NextApiRequest, NextApiResponse } from "next";
import { getSupabaseServer } from "../../../lib/supabaseServer";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";

export const runtime = "edge";

type PropertyRow = { address: string; city: string; state: string; zip: string; rent: number };

function validateRow(row: unknown, index: number): { ok: true; data: PropertyRow } | { ok: false; error: string } {
  if (!row || typeof row !== "object") {
    return { ok: false, error: `Row ${index + 1}: invalid row (expected object).` };
  }
  const r = row as Record<string, unknown>;
  const address = String(r.address ?? "").trim();
  const city = String(r.city ?? "").trim();
  const state = String(r.state ?? "").trim();
  const zip = String(r.zip ?? "").trim();
  const rentValue = r.rent;

  if (!address) return { ok: false, error: `Row ${index + 1}: address is required.` };
  if (!city) return { ok: false, error: `Row ${index + 1}: city is required.` };
  if (!state) return { ok: false, error: `Row ${index + 1}: state is required.` };
  if (!zip) return { ok: false, error: `Row ${index + 1}: zip is required.` };

  const rent =
    typeof rentValue === "number"
      ? rentValue
      : rentValue
        ? parseFloat(String(rentValue).replace(/[^0-9.]/g, ""))
        : null;
  if (rent == null || Number.isNaN(rent) || rent < 0) {
    return { ok: false, error: `Row ${index + 1}: rent must be a valid positive number.` };
  }

  return { ok: true, data: { address, city, state, zip, rent } };
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

  const validated: PropertyRow[] = [];
  const errors: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = validateRow(raw[i], i);
    if (result.ok) validated.push(result.data);
    else errors.push(result.error);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: "Some rows are invalid.",
      invalidRows: errors,
    });
  }

  if (validated.length === 0) {
    return res.status(400).json({ error: "No valid properties to upload." });
  }

  const rows = validated.map((p) => ({
    landlord_id: landlordId,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    rent: p.rent,
    status: "active",
  }));

  const { data, error } = await getSupabaseServer().from("properties").insert(rows).select("id, address, city, state, zip, rent");

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ created: data?.length ?? 0, properties: data ?? [] });
}
