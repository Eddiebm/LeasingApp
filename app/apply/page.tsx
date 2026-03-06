"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type SearchResult = {
  landlordSlug: string;
  propertyId: string;
  address: string;
  landlordName: string;
  rent: number;
  bedrooms: number | null;
};

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export default function ApplyPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/properties/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  const handleCardClick = (landlordSlug: string, propertyId: string) => {
    router.push(`/apply/${encodeURIComponent(landlordSlug)}?property=${encodeURIComponent(propertyId)}`);
  };

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find your rental application</h1>
        <p className="mt-1 text-sm text-slate-600">
          Search by address or landlord name, or enter a property code.
        </p>
      </div>

      <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Search by address or landlord name
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          placeholder="e.g. 123 Main St or Acme Rentals"
        />
        {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
          <p className="text-xs text-slate-500">Type at least {MIN_QUERY_LENGTH} characters to search.</p>
        )}
      </div>

      {searching && (
        <p className="text-sm text-slate-500">Searching…</p>
      )}

      {!searching && debouncedQuery.length >= MIN_QUERY_LENGTH && results.length > 0 && (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.propertyId}>
              <button
                type="button"
                onClick={() => handleCardClick(r.landlordSlug, r.propertyId)}
                className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                <p className="font-medium text-slate-900">{r.address}</p>
                <p className="text-sm text-slate-600">{r.landlordName}</p>
                <p className="mt-1 text-sm text-slate-700">
                  ${r.rent.toLocaleString()}/month
                  {r.bedrooms != null && ` · ${r.bedrooms} bed${r.bedrooms !== 1 ? "s" : ""}`}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!searching && debouncedQuery.length >= MIN_QUERY_LENGTH && results.length === 0 && (
        <p className="text-sm text-slate-500">No properties found. Try a different search or contact your landlord.</p>
      )}

      <p className="text-xs text-slate-500">
        Don&apos;t have a code? Contact your landlord or property manager for your unique application link.
      </p>

      <Link href="/" className="inline-block text-sm font-medium text-slate-700 underline hover:no-underline py-3 px-3">
        ← Back to home
      </Link>
    </main>
  );
}
