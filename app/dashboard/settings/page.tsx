"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type Profile = {
  company_name: string | null;
  phone: string | null;
  slug: string | null;
};

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ companyName: "", phone: "", slug: "" });
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/dashboard/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.landlord) {
          const l = data.landlord;
          setProfile({
            company_name: l.company_name ?? null,
            phone: l.phone ?? null,
            slug: l.slug ?? null
          });
          setForm({
            companyName: l.company_name ?? "",
            phone: l.phone ?? "",
            slug: l.slug ?? ""
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          companyName: form.companyName.trim() || null,
          phone: form.phone.trim() || null,
          slug: form.slug.trim() || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Could not save." });
        return;
      }
      setProfile(data);
      setMessage({ type: "ok", text: "Saved." });
    } catch (err) {
      setMessage({ type: "err", text: "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  if (!session && !loading) {
    router.replace("/dashboard/login");
    return null;
  }

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-slate-600">Edit your company profile and apply-link slug.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-md space-y-4">
            <div>
              <label htmlFor="companyName" className="mb-1 block text-sm font-medium text-slate-700">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1 block text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                id="phone"
                type="text"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="slug" className="mb-1 block text-sm font-medium text-slate-700">
                Apply-link slug
              </label>
              <p className="mb-1 text-xs text-slate-500">
                Your apply URL: /apply/<strong>{form.slug || "your-slug"}</strong>. Letters, numbers, and hyphens only; must be unique.
              </p>
              <input
                id="slug"
                type="text"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="your-company"
              />
            </div>
            {message && (
              <p className={message.type === "ok" ? "text-sm text-green-700" : "text-sm text-red-600"}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
