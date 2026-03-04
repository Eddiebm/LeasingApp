"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import Link from "next/link";

const DOC_TYPES = [
  { value: "tenant_id", label: "ID (driver’s license or passport)" },
  { value: "paystub", label: "Pay stub / proof of income" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other document" }
] as const;

export default function ApplyDocumentsPage() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";

  const [type, setType] = useState<string>("tenant_id");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState("");

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setError("");
  }, []);

  const handleUpload = useCallback(async () => {
    if (!applicationId) {
      setError("Missing application ID. Start from the application form.");
      return;
    }
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise<void>((resolve, reject) => {
        reader.onload = () => resolve();
        reader.onerror = reject;
      });
      const fileBase64 = reader.result as string;

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          type,
          fileBase64,
          fileName: file.name,
          fileType: file.type
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }
      setUploaded((prev) => [...prev, `${type}: ${file.name}`]);
      setFile(null);
      if (typeof document !== "undefined") {
        const input = document.getElementById("file-input") as HTMLInputElement;
        if (input) input.value = "";
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [applicationId, type, file]);

  if (!applicationId) {
    return (
      <main className="space-y-4">
        <h1 className="text-2xl font-bold">Upload Documents</h1>
        <p className="text-slate-600">
          This page is for uploading documents after you submit an application. Please complete your{" "}
          <Link href="/apply" className="text-black underline">
            rental application
          </Link>{" "}
          first; you’ll then get a link to upload documents.
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Upload Documents</h1>
      <p className="text-sm text-slate-600">
        Upload ID, pay stubs, or other documents required by the leasing agency.
      </p>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Document type</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {DOC_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">File</label>
          <input
            id="file-input"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.heic"
            className="w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium"
            onChange={handleFileChange}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={uploading || !file}
          onClick={handleUpload}
          className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>

        {uploaded.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">Uploaded</p>
            <ul className="text-sm text-slate-700 list-disc list-inside">
              {uploaded.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-500">
        <Link href="/" className="underline">Back to home</Link>
      </p>
    </main>
  );
}
