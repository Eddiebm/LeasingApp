import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * PATCH /api/dashboard/settings
 * Body: { companyName?, phone?, slug? }
 * Landlord only. Updates own profile. Slug must be unique (excluding self).
 */
export default async function handler(req: Request) {
  if (req.method !== "PATCH") return new Response(null, { status: 405 });

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) {
    return json({ error: "Unauthorized" }, 401);
  }

  const token = req.headers.get("authorization")?.startsWith("Bearer ") ? req.headers.get("authorization").slice(7) : null;
  if (!token) return json({ error: "Unauthorized" }, 401);
  const supabase = createSupabaseForUser(token);

  const { companyName, phone, slug: rawSlug } = body ?? {};
  const updates: { company_name?: string; phone?: string; slug?: string } = {};

  if (companyName !== undefined) {
    updates.company_name = String(companyName).trim() || null;
  }
  if (phone !== undefined) {
    updates.phone = String(phone).trim() || null;
  }
  if (rawSlug !== undefined) {
    const slug = typeof rawSlug === "string" ? slugify(rawSlug) : "";
    if (!slug) return json({ error: "Slug cannot be empty" }, 400);
    const { data: existing } = await getSupabaseServer()
      .from("landlords")
      .select("id")
      .eq("slug", slug)
      .neq("id", auth.landlord.id)
      .maybeSingle();
    if (existing) return json({ error: "This URL slug is already taken. Choose another." }, 409);
    updates.slug = slug;
  }

  if (Object.keys(updates).length === 0) {
    return json({ error: "No fields to update" }, 400);
  }

  const { data, error } = await supabase
    .from("landlords")
    .update(updates)
    .eq("id", auth.landlord.id)
    .select("company_name, phone, slug")
    .single();

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }
  return json(data);
}
