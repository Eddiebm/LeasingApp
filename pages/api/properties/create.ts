import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body ?? {};
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  const state = String(body.state ?? "").trim();
  const zip = String(body.zip ?? "").trim();
  const rentValue = body.rent;

  if (!address || !city || !state || !zip) {
    return res.status(400).json({ error: "Address, city, state, and zip are required." });
  }

  const rent =
    typeof rentValue === "number"
      ? rentValue
      : rentValue
      ? parseFloat(String(rentValue).replace(/[^0-9.]/g, ""))
      : null;

  if (rent == null || Number.isNaN(rent)) {
    return res.status(400).json({ error: "Rent must be a valid number." });
  }

  let landlordId: string | null = null;
  if (auth.role === "landlord") {
    landlordId = auth.landlordId;
  } else if (auth.role === "admin" && body.landlordId) {
    landlordId = String(body.landlordId);
  }

  if (!landlordId) {
    return res.status(400).json({ error: "A landlord is required for this property." });
  }

  const { data, error } = await supabaseServer
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
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
}

