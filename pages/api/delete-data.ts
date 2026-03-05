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
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  if (!email) return json({ error: "Email required." }, 400);

  return json({
    message: "Deletion request received. We will verify your identity and process your request; you will be contacted at the email you provided."
  });
}
