import { runScreening } from "../../lib/runScreening";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const { firstName, lastName, dob } = body;
  const result = await runScreening({
    firstName: firstName as string,
    lastName: lastName as string,
    dob: dob as string
  });
  return json(result);
}

