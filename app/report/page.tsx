"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  { value: "plumbing", label: "Plumbing" },
  { value: "electrical", label: "Electrical" },
  { value: "hvac", label: "HVAC" },
  { value: "appliance", label: "Appliance" },
  { value: "pest", label: "Pest" },
  { value: "other", label: "Other" }
];

export default function ReportPage() {
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          category,
          description: description.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
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
            We've received your maintenance request and will address it as soon as possible.
          </p>
        </div>
        <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Report a problem</h1>
      <p className="text-sm text-slate-600">
        Enter the email address you used on your application, then describe the issue.
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
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            placeholder="The email you used on your application"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <select
            id="category"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
          <textarea
            id="description"
            required
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            placeholder="Describe the issue..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
      <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
    </main>
  );
}
