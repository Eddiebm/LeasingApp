import type { NextApiRequest, NextApiResponse } from "next";

export const runtime = "edge";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const email = req.body?.email?.trim?.();
  if (!email) return res.status(400).json({ error: "Email required." });

  return res.status(200).json({
    message: "Deletion request received. We will verify your identity and process your request; you will be contacted at the email you provided."
  });
}
