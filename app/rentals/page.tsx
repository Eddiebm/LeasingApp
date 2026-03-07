"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

type Rental = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  photos: string[] | null;
  landlord_name: string;
  landlord_slug: string | null;
};

type ApiResponse = {
  rentals: Rental[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export default function RentalsPage() {
  const [city, setCity] = useState("");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [petsAllowed, setPetsAllowed] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (city.trim()) params.set("city", city.trim());
    if (minRent.trim()) params.set("min_rent", minRent.trim());
    if (maxRent.trim()) params.set("max_rent", maxRent.trim());
    if (bedrooms.trim()) params.set("bedrooms", bedrooms.trim());
    if (petsAllowed) params.set("pets_allowed", petsAllowed);
    params.set("page", String(page));
    fetch(`/api/rentals?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [city, minRent, maxRent, bedrooms, petsAllowed, page]);

  const rentals = data?.rentals ?? [];
  const totalPages = data?.total_pages ?? 0;
  const total = data?.total ?? 0;

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Rental listings</h1>
        <p className="mt-1 text-slate-600">Browse available properties.</p>

        <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">City / location</span>
            <input
              type="text"
              placeholder="Search city..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Min rent ($)</span>
            <input
              type="number"
              placeholder="Min"
              value={minRent}
              onChange={(e) => setMinRent(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Max rent ($)</span>
            <input
              type="number"
              placeholder="Max"
              value={maxRent}
              onChange={(e) => setMaxRent(e.target.value)}
              className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Bedrooms</span>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4+</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Pets</span>
            <select
              value={petsAllowed}
              onChange={(e) => setPetsAllowed(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
              <option value="negotiable">Negotiable</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setPage(1)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Apply filters
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-slate-500">Loading…</p>
        ) : rentals.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-slate-600">No listings found matching your search.</p>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rentals.map((r) => {
                const cover = Array.isArray(r.photos) && r.photos[0] ? r.photos[0] : null;
                const addressLine = [r.address, r.city, r.state].filter(Boolean).join(", ");
                return (
                  <article
                    key={r.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {cover ? (
                      <div className="relative aspect-[4/3] bg-slate-200">
                        <Image src={cover} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] bg-slate-100" />
                    )}
                    <div className="p-4">
                      <p className="font-medium text-slate-800">{addressLine}</p>
                      {r.rent != null && <p className="mt-1 text-sm text-slate-600">${r.rent.toLocaleString()}/mo</p>}
                      <p className="mt-1 text-xs text-slate-500">
                        {r.bedrooms ?? "—"} bed · {r.bathrooms ?? "—"} bath
                      </p>
                      <Link
                        href={`/rentals/${r.id}`}
                        className="mt-3 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                      >
                        View listing
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-slate-600">
                  Page {page} of {totalPages} ({total} total)
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
