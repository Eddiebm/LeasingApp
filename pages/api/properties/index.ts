import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";
import { getDashboardUser } from "../../../lib/apiAuth";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const forDashboard = req.query.for === "dashboard";
  if (forDashboard) {
    const auth = await getDashboardUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
  }

  let query = supabase
    .from("properties")
    .select("id, address, city, state, zip, rent, status, application_deadline")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json(data ?? []);
}
