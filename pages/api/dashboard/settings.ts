import type { NextApiRequest, NextApiResponse } from "next";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { createSupabaseForUser } from "../../../lib/supabaseUser";
import { getSupabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

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
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== "landlord" || !auth.landlord) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  const supabase = createSupabaseForUser(token);

  const { companyName, phone, slug: rawSlug } = req.body ?? {};
  const updates: { company_name?: string; phone?: string; slug?: string } = {};

  if (companyName !== undefined) {
    updates.company_name = String(companyName).trim() || null;
  }
  if (phone !== undefined) {
    updates.phone = String(phone).trim() || null;
  }
  if (rawSlug !== undefined) {
    const slug = typeof rawSlug === "string" ? slugify(rawSlug) : "";
    if (!slug) return res.status(400).json({ error: "Slug cannot be empty" });
    const { data: existing } = await getSupabaseServer()
      .from("landlords")
      .select("id")
      .eq("slug", slug)
      .neq("id", auth.landlord.id)
      .maybeSingle();
    if (existing) return res.status(409).json({ error: "This URL slug is already taken. Choose another." });
    updates.slug = slug;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No fields to update" });
  }

  const { data, error } = await supabase
    .from("landlords")
    .update(updates)
    .eq("id", auth.landlord.id)
    .select("company_name, phone, slug")
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json(data);
}
