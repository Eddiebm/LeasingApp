"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardOnboardingPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState<"UK" | "US">("US");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { supabase } = await import("../../../lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        router.replace("/dashboard/login");
        return;
      }
      const res = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          companyName: companyName.trim() || undefined,
          phone: phone.trim() || undefined,
          slug: slug.trim() || undefined,
          country,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">Complete your profile</h1>
      <p className="text-sm text-slate-600">
        You’re almost there. Add your details so tenants can apply to your properties.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <fieldset className="space-y-2">
          <legend className="mb-1 block text-sm font-medium text-slate-700">
            Where are your rental properties located?
          </legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="country"
              value="US"
              checked={country === "US"}
              onChange={() => setCountry("US")}
            />
            <span>United States</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="country"
              value="UK"
              checked={country === "UK"}
              onChange={() => setCountry("UK")}
            />
            <span>United Kingdom</span>
          </label>
        </fieldset>

        <div>
          <label htmlFor="onboarding-fullName" className="mb-1 block text-sm font-medium text-slate-700">
            Full name *
          </label>
          <input
            id="onboarding-fullName"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboarding-companyName" className="mb-1 block text-sm font-medium text-slate-700">
            Company name
          </label>
          <input
            id="onboarding-companyName"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Acme Properties"
          />
        </div>
        <div>
          <label htmlFor="onboarding-phone" className="mb-1 block text-sm font-medium text-slate-700">
            Phone
          </label>
          <input
            id="onboarding-phone"
            type="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="onboarding-slug" className="mb-1 block text-sm font-medium text-slate-700">
            Apply link slug
          </label>
          <input
            id="onboarding-slug"
            type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. acme-properties"
          />
          <p className="mt-1 text-xs text-slate-500">
            Tenants will apply at: /apply/<strong>{slug || "your-slug"}</strong>
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Saving…" : "Continue to dashboard"}
        </button>
      </form>
      <Link href="/dashboard" className="block text-center text-sm underline text-slate-600">
        Back to dashboard
      </Link>
    </main>
  );
}
