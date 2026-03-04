import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../../lib/supabaseServer";

const ALLOWED_TYPES = ["tenant_id", "paystub", "bank_statement", "other"] as const;
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export const config = {
  api: { bodyParser: { sizeLimit: "11mb" } }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const { applicationId, type, fileBase64, fileName } = req.body;

  if (!applicationId || !type || !fileBase64) {
    return res.status(400).json({ error: "Missing applicationId, type, or file" });
  }
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({ error: "Invalid document type" });
  }

  let buffer: Buffer;
  try {
    const base64 = fileBase64.replace(/^data:[^;]+;base64,/, "");
    buffer = Buffer.from(base64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid file data" });
  }

  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: "File too large (max 10 MB)" });
  }

  const ext = fileName?.split(".").pop() || "bin";
  const safeName = `${type}-${applicationId}-${Date.now()}.${ext}`;
  const bucket = "documents";

  const { error: uploadError } = await supabaseServer.storage
    .from(bucket)
    .upload(safeName, buffer, { contentType: req.body.fileType || "application/octet-stream", upsert: true });

  if (uploadError) {
    console.error(uploadError);
    return res.status(500).json({ error: uploadError.message });
  }

  const { data: urlData } = supabaseServer.storage.from(bucket).getPublicUrl(safeName);

  const { error: insertError } = await supabaseServer.from("documents").insert({
    application_id: applicationId,
    type,
    file_url: urlData.publicUrl
  });

  if (insertError) {
    console.error(insertError);
    return res.status(500).json({ error: insertError.message });
  }

  return res.status(200).json({ success: true, url: urlData.publicUrl });
}
