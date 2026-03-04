import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";
import { getDashboardUser } from "../../../lib/apiAuth";

export const runtime = "edge";

const STATUSES = ["submitted", "in_progress", "resolved"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing request id" });

  if (req.method === "PATCH") {
    const auth = await getDashboardUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    const { status } = req.body ?? {};
    if (!status || !STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Use submitted, in_progress, or resolved." });
    }

    const { error } = await supabase
      .from("maintenance_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
