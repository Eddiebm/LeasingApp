"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const URGENCIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
];

function ReportForm() {
  const searchParams = useSearchParams();
  const [applicationId, setApplicationId] = useState("");
  const [email, setEmail] = useState("");
  const [unitOrAddress, setUnitOrAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = searchParams.get("applicationId");
    if (id) setApplicationId(id);
  }, [searchParams]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result as string);
      setPhotoFileName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        applicationId: applicationId.trim(),
        email: email.trim(),
        unitOrAddress: unitOrAddress.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        urgency
      };
      if (photoBase64) {
        body.photoBase64 = photoBase64;
        body.photoFileName = photoFileName || "photo.jpg";
      }
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setTicketId(data.requestId ?? data.id ?? null);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <h1 className="text-xl font-bold text-emerald-800">Request submitted</h1>
          <p className="mt-2 text-slate-700">
            Your request has been submitted. Your landlord will be in touch.
          </p>
          {ticketId && (
            <p className="mt-4 rounded-lg bg-white/80 px-4 py-2 font-mono text-sm text-slate-800">
              Ticket number: <strong>{ticketId}</strong>
            </p>
          )}
        </div>
        <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-8">
      <h1 className="text-2xl font-bold">Report a problem</h1>
      <p className="text-sm text-slate-600">
        Submit a maintenance request. We'll send a confirmation with your ticket number to your email.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>
        )}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="unitOrAddress" className="mb-1 block text-sm font-medium text-slate-700">Unit / Address</label>
          <input
            id="unitOrAddress"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
            placeholder="e.g. Unit 4 or 123 Main St"
            value={unitOrAddress}
            onChange={(e) => setUnitOrAddress(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="applicationId" className="mb-1 block text-sm font-medium text-slate-700">Application ID</label>
          <input
            id="applicationId"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
            placeholder="From your confirmation email"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700">Issue title</label>
          <input
            id="title"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
            placeholder="e.g. Leaking faucet in kitchen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            id="description"
            required
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[120px] touch-manipulation"
            placeholder="Describe the issue in detail..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="urgency" className="mb-1 block text-sm font-medium text-slate-700">Urgency</label>
          <select
            id="urgency"
            className="w-full rounded-lg border border-slate-300 px-3 py-3 text-sm min-h-[48px] touch-manipulation"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
          >
            {URGENCIES.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-4">
          <p className="mb-2 text-sm font-medium text-slate-700">Photo of the issue (optional)</p>
          <p className="mb-3 text-xs text-slate-500">
            Take a picture or upload one. Helps your landlord see the problem quickly.
          </p>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={handlePhotoChange}
            aria-label="Add photo"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-700 touch-manipulation"
            >
              Take photo or upload
            </button>
            {photoBase64 && (
              <>
                <span className="flex items-center text-sm text-emerald-600">Photo added</span>
                <button
                  type="button"
                  onClick={() => { setPhotoBase64(null); setPhotoFileName(""); }}
                  className="text-sm text-slate-500 underline touch-manipulation"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 touch-manipulation"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
      <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
    </main>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<main className="space-y-6"><p className="text-slate-500">Loading…</p></main>}>
      <ReportForm />
    </Suspense>
  );
}
