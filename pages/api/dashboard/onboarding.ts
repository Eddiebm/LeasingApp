import { createClient } from "@supabase/supabase-js";
import { getLandlordOrAdmin } from "../../../lib/apiAuth";
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
 * POST /api/dashboard/onboarding
 * Body: { fullName, companyName?, phone?, slug? }
 * Creates landlords row + user_roles (landlord) for the current user. Slug must be unique.
 */
export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const auth = await getLandlordOrAdmin(req);
  if (!auth || auth.role !== null) {
    return json({ error: "Already onboarded or unauthorized" }, 400);
  }

  const { fullName, companyName, phone, slug: rawSlug } = body ?? {};
  const fullNameStr = String(fullName ?? "").trim();
  if (!fullNameStr) return json({ error: "fullName is required" }, 400);

  let slug: string | null = typeof rawSlug === "string" ? slugify(rawSlug) : null;
  if (!slug && companyName) slug = slugify(String(companyName));
  if (!slug) slug = slugify(fullNameStr);
  if (!slug) return json({ error: "Could not generate a slug; provide slug or companyName" }, 400);

  const { data: existing } = await getSupabaseServer().from("landlords").select("id").eq("slug", slug).maybeSingle();
  if (existing) return json({ error: "This URL slug is already taken. Choose another." }, 409);

  const { data: landlord, error: landlordError } = await getSupabaseServer()
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
    return json({ error: landlordError?.message ?? "Failed to create landlord profile" }, 500);
  }

  const { error: roleError } = await getSupabaseServer().from("user_roles").upsert(
    { user_id: auth.user.id, role: "landlord" },
    { onConflict: "user_id" }
  );

  if (roleError) {
    console.error(roleError);
    await getSupabaseServer().from("landlords").delete().eq("id", landlord.id);
    return json({ error: "Failed to assign role" }, 500);
  }

  return json({
    success: true,
    landlord: { id: landlord.id, slug: landlord.slug, companyName: landlord.company_name },
  });
}
