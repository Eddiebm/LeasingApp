import type { NextApiRequest, NextApiResponse } from "next";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";

export const runtime = "edge";

/**
 * GET /api/dashboard/me
 * Returns current dashboard user and role. Used to decide redirect to onboarding vs dashboard.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return res.status(401).json({ error: "Unauthorized" });

  if (auth.role === null) {
    return res.status(200).json({ needsOnboarding: true, email: auth.email });
  }

  if (auth.role === "admin") {
    return res.status(200).json({ role: "admin", email: auth.email });
  }

  return res.status(200).json({
    role: "landlord",
    email: auth.email,
    landlord: auth.landlord,
  });
}
