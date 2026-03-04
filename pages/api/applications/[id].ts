import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "../../../../lib/supabaseClient";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = req.query.id as string;
  if (!id) return res.status(400).json({ error: "Missing application id" });

  if (req.method === "PATCH") {
    const { status } = req.body;
    if (!status || !["approved", "rejected", "pending"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const { error } = await supabase.from("applications").update({ status }).eq("id", id);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}
