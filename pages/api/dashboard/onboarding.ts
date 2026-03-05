import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * POST /api/dashboard/onboarding
 * Body: { fullName, companyName?, phone?, slug? }
 * Creates landlords row + user_roles (landlord) for the current user. Slug must be unique.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== null) {
    return res.status(400).json({ error: "Already onboarded or unauthorized" });
  }

  const { fullName, companyName, phone, slug: rawSlug } = req.body ?? {};
  const fullNameStr = String(fullName ?? "").trim();
  if (!fullNameStr) return res.status(400).json({ error: "fullName is required" });

  let slug: string | null = typeof rawSlug === "string" ? slugify(rawSlug) : null;
  if (!slug && companyName) slug = slugify(String(companyName));
  if (!slug) slug = slugify(fullNameStr);
  if (!slug) return res.status(400).json({ error: "Could not generate a slug; provide slug or companyName" });

  const { data: existing } = await supabaseServer.from("landlords").select("id").eq("slug", slug).maybeSingle();
  if (existing) return res.status(409).json({ error: "This URL slug is already taken. Choose another." });

  const { data: landlord, error: landlordError } = await supabaseServer
    .from("landlords")
    .insert({
      user_id: auth.user.id,
      full_name: fullNameStr,
      company_name: companyName ? String(companyName).trim() : null,
      email: auth.email,
      phone: phone ? String(phone).trim() : null,
      slug,
    })
    .select("id, slug, company_name")
    .single();

  if (landlordError || !landlord) {
    console.error(landlordError);
    return res.status(500).json({ error: landlordError?.message ?? "Failed to create landlord profile" });
  }

  const { error: roleError } = await supabaseServer.from("user_roles").upsert(
    { user_id: auth.user.id, role: "landlord" },
    { onConflict: "user_id" }
  );

  if (roleError) {
    console.error(roleError);
    await supabaseServer.from("landlords").delete().eq("id", landlord.id);
    return res.status(500).json({ error: "Failed to assign role" });
  }

  return res.status(200).json({
    success: true,
    landlord: { id: landlord.id, slug: landlord.slug, companyName: landlord.company_name },
  });
}
