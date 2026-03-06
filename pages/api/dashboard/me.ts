import { getLandlordOrAdmin } from "../../../lib/apiAuth";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * GET /api/dashboard/me
 * Returns current dashboard user and role. Used to decide redirect to onboarding vs dashboard.
 */
export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  if (auth.role === null) {
    return json({ needsOnboarding: true, email: auth.email }, 200);
  }

  if (auth.role === "admin") {
    return json({ role: "admin", email: auth.email }, 200);
  }

  const landlord = auth.landlord!;
  return json({
    role: "landlord",
    email: auth.email,
    landlord,
    subscription_status: landlord.subscription_status ?? "inactive",
    country: landlord.country ?? "UK",
  }, 200);
}
