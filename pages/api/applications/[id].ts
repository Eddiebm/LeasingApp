import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../lib/supabaseClient";
import { getDashboardUser } from "../../../lib/apiAuth";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing application id" });

  if (req.method === "PATCH") {
    const auth = await getDashboardUser(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });
    const { status, changedBy } = req.body ?? {};
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { data: existing } = await supabase.from("applications").select("status").eq("id", id).single();
    const fromStatus = (existing as { status?: string } | null)?.status ?? null;

    const { error } = await supabase.from("applications").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    await supabase.from("application_status_history").insert({
      application_id: id,
      from_status: fromStatus,
      to_status: status,
      changed_by: changedBy ?? auth.email
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
