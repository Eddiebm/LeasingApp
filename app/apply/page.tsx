"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ApplyPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const slug = query.trim().toLowerCase();
    if (!slug) return;
    router.push(`/apply/${encodeURIComponent(slug)}`);
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find your rental application</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the property code or landlord name from your viewing or message.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Enter the property code or landlord name
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="e.g. ACME-1234 or Acme Rentals"
        />
        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          disabled={!query.trim()}
        >
          Find application
        </button>
        <p className="text-xs text-slate-500">
          Don&apos;t have a code? Contact your landlord or property manager for your unique application link.
        </p>
      </form>

      <Link href="/" className="inline-block text-sm font-medium text-slate-700 underline hover:no-underline">
        Back to home
      </Link>
    </main>
  );
}

