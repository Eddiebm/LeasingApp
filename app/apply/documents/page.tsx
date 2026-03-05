"use client";

import { useSearchParams } from "next/navigation";
import { useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";

const DOC_TYPES = [
  { value: "tenant_id", label: "ID (driver’s license or passport)" },
  { value: "paystub", label: "Pay stub / proof of income" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "other", label: "Other document" }
] as const;

function ApplyDocumentsContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";

  const [type, setType] = useState<string>("tenant_id");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
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
    <main className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold">Upload Documents</h1>
      <p className="text-sm text-slate-600">
        Take a photo of your ID, pay stubs, or other documents, or upload a file. Works great on your phone.
      </p>

      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Document type</label>
          <select
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
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

        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">Add document</label>
          <p className="mb-3 text-xs text-slate-500">
            Use your camera to photograph the document, or choose a file from your device.
          </p>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Take photo"
          />
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept=".pdf,image/*,.heic"
            className="sr-only"
            onChange={handleFileChange}
            aria-label="Choose file"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 touch-manipulation"
            >
              Take photo
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 touch-manipulation"
            >
              Choose file
            </button>
          </div>
          {file && (
            <p className="mt-2 text-sm text-slate-600">
              Selected: {file.name}
            </p>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="button"
          disabled={uploading || !file}
          onClick={handleUpload}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 touch-manipulation"
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

export default function ApplyDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}>
      <ApplyDocumentsContent />
    </Suspense>
  );
}
