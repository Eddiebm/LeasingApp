import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).end();
  }

  const applicationId = req.query.applicationId as string;
  if (!applicationId) {
    return res.status(400).json({ error: "Missing applicationId" });
  }

  const { data, error } = await supabase
    .from("documents")
    .select("id, type, file_url, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data ?? []);
}
