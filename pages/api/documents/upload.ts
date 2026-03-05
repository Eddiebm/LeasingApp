import { supabaseServer } from "../../../lib/supabaseServer";

export const runtime = "edge";

const ALLOWED_TYPES = ["tenant_id", "paystub", "bank_statement", "other"] as const;
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

// Edge-compatible base64 decode (no Buffer)
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default async function handler(req: Request) {
  if (req.method !== "POST") return new Response(null, { status: 405 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const { applicationId, type, fileBase64, fileName, fileType } = body as Record<string, string>;

  if (!applicationId || !type || !fileBase64) {
    return json({ error: "Missing applicationId, type, or file" }, 400);
  }
  if (!ALLOWED_TYPES.includes(type as typeof ALLOWED_TYPES[number])) {
    return json({ error: "Invalid document type" }, 400);
  }

  let bytes: Uint8Array;
  try {
    const base64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
    bytes = base64ToUint8Array(base64);
  } catch {
    return json({ error: "Invalid file data" }, 400);
  }

  if (bytes.length > MAX_SIZE) {
    return json({ error: "File too large (max 10 MB)" }, 400);
  }

  const ext = fileName?.split(".").pop() || "bin";
  const safeName = `${type}-${applicationId}-${Date.now()}.${ext}`;
  const bucket = "documents";

  const { error: uploadError } = await supabaseServer.storage
    .from(bucket)
    .upload(safeName, bytes, { contentType: fileType || "application/octet-stream", upsert: true });

  if (uploadError) {
    console.error(uploadError);
    return json({ error: uploadError.message }, 500);
  }

  const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(safeName);

  const { error: insertError } = await supabaseServer.from("documents").insert({
    application_id: applicationId,
    type,
    file_url: urlData.publicUrl
  });

  if (insertError) {
    console.error(insertError);
    return json({ error: insertError.message }, 500);
  }

  return json({ success: true, url: urlData.publicUrl });
}
