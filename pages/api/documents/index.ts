import { supabase } from "../../../lib/supabaseClient";

export const runtime = "edge";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

export default async function handler(req: Request) {
  if (req.method !== "GET") return new Response(null, { status: 405 });

  const url = new URL(req.url);
  const applicationId = url.searchParams.get("applicationId") ?? "";
  if (!applicationId) return json({ error: "Missing applicationId" }, 400);

  const { data, error } = await supabase
    .from("documents")
    .select("id, type, file_url, created_at, signing_token_expires_at, signed_at, signed_by_name, signed_pdf_url, tenant_email")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return json({ error: error.message }, 500);
  }

  return json(data ?? []);
}
