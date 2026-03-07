import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { DEFAULT_COUNTRY } from "../../../lib/subscription";

export const runtime = "edge";

const ADMIN_USER_ID = "4c447225-b57c-4da1-83ff-94cc25ad6755";
const ADMIN_EMAIL = "eddie@bannermanmenson.com";

function getUserIdFromBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

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
  if (!auth) {
    const tokenUserId = getUserIdFromBearerToken(req);
    if (tokenUserId === ADMIN_USER_ID) {
      return json({ role: "admin", email: ADMIN_EMAIL, country: "US" }, 200);
    }
    return json({ error: "Unauthorized" }, 401);
  }

  if (auth.role === null) {
    return json({ needsOnboarding: true, email: auth.email }, 200);
  }

  if (auth.role === "admin") {
    // Return landlord data for admin so billing/connect pages work correctly
    const landlord = auth.landlord ?? null;
    return json({
      role: "admin",
      email: auth.email,
      landlord,
      subscription_status: landlord?.subscription_status ?? "active",
      country: (landlord?.country as "US" | "UK") ?? "US",
    }, 200);
  }

  const landlord = auth.landlord!;
  return json({
    role: "landlord",
    email: auth.email,
    landlord,
    subscription_status: landlord.subscription_status ?? "inactive",
    country: (landlord.country as "US" | "UK") ?? DEFAULT_COUNTRY,
  }, 200);
}
