"use client";

import { useState } from "react";
import Link from "next/link";

export default function RequestDataPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/request-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  if (submitted) {
    return (
      <main className="space-y-6">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <h1 className="text-xl font-bold text-emerald-800">Request received</h1>
          <p className="mt-2 text-slate-700">
            We’ll verify your identity and send you a copy of your data. Check the email you provided.
          </p>
        </div>
        <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Request my data</h1>
      <p className="text-sm text-slate-600">Enter the email you used on your application.</p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
        <div>
          <label htmlFor="request-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="request-email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button type="submit" className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white">
          Submit request
        </button>
      </form>
      <Link href="/privacy" className="block text-center text-sm underline text-slate-600">Back to Privacy</Link>
    </main>
  );
}
