import type { NextApiRequest, NextApiResponse } from "next";
import { runScreening } from "../../lib/runScreening";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { firstName, lastName, dob } = req.body;
  const result = await runScreening({ firstName, lastName, dob });
  return res.status(200).json(result);
}

