"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../../../lib/supabaseClient";

type ListingData = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number | null;
  is_listed: boolean;
  listing_headline: string | null;
  listing_description: string | null;
  listing_photo_url: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  available_from: string | null;
  listing_slug: string | null;
};

const BASE_URL = "https://leasingapp.pages.dev";

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined"
    ? (window as unknown as Record<string, unknown>).__supabaseSession as string | undefined
    : undefined;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function ListingManagerPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  const [listing, setListing] = useState<ListingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [form, setForm] = useState({
    listing_headline: "",
    listing_description: "",
    bedrooms: "",
    bathrooms: "",
    available_from: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get auth token from supabase session
  const [authToken, setAuthToken] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthToken(data.session?.access_token ?? null);
    });
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }, [authToken]);

  const fetchListing = useCallback(async () => {
    if (!propertyId || !authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/listing`, {
        headers: authHeaders(),
      });
      if (res.status === 401) { router.push("/dashboard/login"); return; }
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      setListing(data);
      setForm({
        listing_headline: data.listing_headline ?? "",
        listing_description: data.listing_description ?? "",
        bedrooms: data.bedrooms != null ? String(data.bedrooms) : "",
        bathrooms: data.bathrooms != null ? String(data.bathrooms) : "",
        available_from: data.available_from ?? "",
      });
    } finally {
      setLoading(false);
    }
  }, [propertyId, authToken, authHeaders, router]);

  useEffect(() => {
    if (authToken) fetchListing();
  }, [authToken, fetchListing]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/properties/${propertyId}/listing`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_headline: form.listing_headline,
          listing_description: form.listing_description,
          bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
          bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
          available_from: form.available_from || null,
        }),
      });
      if (res.ok) {
        await fetchListing();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!listing) return;
    setPublishing(true);
    try {
      const endpoint = listing.is_listed ? "unpublish" : "publish";
      const res = await fetch(`/api/properties/${propertyId}/${endpoint}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        await fetchListing();
        if (endpoint === "publish") setShareOpen(true);
      }
    } finally {
      setPublishing(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Photo must be under 5MB."); return; }
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/properties/${propertyId}/photo`, {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      if (res.ok) await fetchListing();
      else { const d = await res.json(); alert(d.error ?? "Photo upload failed."); }
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const copyLink = async () => {
    if (!listing?.listing_slug) return;
    await navigator.clipboard.writeText(`${BASE_URL}/listing/${listing.listing_slug}`);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const downloadSocialCard = () => {
    window.open(`/api/properties/${propertyId}/social-card`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading listing…</p>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-slate-600">Property not found.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm text-emerald-600 hover:underline">← Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const listingUrl = listing.listing_slug ? `${BASE_URL}/listing/${listing.listing_slug}` : null;
  const shareText = encodeURIComponent(
    `${listing.listing_headline ?? listing.address} — $${listing.rent?.toLocaleString() ?? "?"}/mo. Apply now:`
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-700">← Dashboard</Link>
            <h1 className="mt-1 text-xl font-bold text-slate-900">Listing Manager</h1>
            <p className="text-sm text-slate-500">{listing.address}, {listing.city}, {listing.state}</p>
          </div>
          <button
            type="button"
            onClick={handleTogglePublish}
            disabled={publishing}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
              listing.is_listed
                ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                : "bg-black text-white hover:bg-slate-800"
            }`}
          >
            {publishing ? "…" : listing.is_listed ? "Unpublish" : "Publish listing"}
          </button>
        </div>

        {/* Status badge */}
        {listing.is_listed && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-medium text-emerald-800">Live — tenants can view and apply</span>
          </div>
        )}

        {/* Listing details form */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800">Listing details</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Headline</label>
              <input
                type="text"
                placeholder="Spacious 3-bed apartment in Austin"
                value={form.listing_headline}
                onChange={(e) => setForm({ ...form, listing_headline: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                maxLength={120}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <textarea
                placeholder="Describe the property — features, neighbourhood, what's included…"
                value={form.listing_description}
                onChange={(e) => setForm({ ...form, listing_description: e.target.value })}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bedrooms</label>
                <select
                  value={form.bedrooms}
                  onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">—</option>
                  {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
                  <option value="6">6+</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bathrooms</label>
                <select
                  value={form.bathrooms}
                  onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                >
                  <option value="">—</option>
                  {[1, 1.5, 2, 2.5, 3, 3.5, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Available from</label>
                <input
                  type="date"
                  value={form.available_from}
                  onChange={(e) => setForm({ ...form, available_from: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : saveSuccess ? "Saved ✓" : "Save listing"}
            </button>
          </form>
        </section>

        {/* Photo upload */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Listing photo</h2>
          {listing.listing_photo_url ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.listing_photo_url}
                alt="Listing photo"
                className="w-full rounded-xl object-cover max-h-52"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {uploadingPhoto ? "Uploading…" : "Change photo"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="w-full rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-slate-400 transition-colors disabled:opacity-60"
            >
              <p className="text-sm font-medium text-slate-700">
                {uploadingPhoto ? "Uploading…" : "Upload a photo"}
              </p>
              <p className="mt-1 text-xs text-slate-500">JPEG or PNG, max 5MB</p>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoUpload}
          />
        </section>

        {/* Share section — only shown when listed */}
        {listing.is_listed && listingUrl && (
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Share your listing</h2>

            {/* Listing URL */}
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-700 break-all">
                {listingUrl}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                {copyFeedback ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Social share buttons */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>f</span> Facebook
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(listingUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>𝕏</span> Twitter
              </a>
              <a
                href={`https://wa.me/?text=${shareText}%20${encodeURIComponent(listingUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>💬</span> WhatsApp
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(listingUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>in</span> LinkedIn
              </a>
            </div>

            {/* Social card download */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Download social card</p>
                <p className="text-xs text-slate-500 mt-0.5">1080×1080 image — ready to post on Instagram, Facebook, or X</p>
              </div>
              <button
                type="button"
                onClick={downloadSocialCard}
                className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Download
              </button>
            </div>
          </section>
        )}

        {/* CTA to publish if not listed */}
        {!listing.is_listed && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">Ready to share this listing?</p>
            <p className="mt-1 text-xs text-slate-500">
              Save your listing details above, then click "Publish listing" to make it live and get your share link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
