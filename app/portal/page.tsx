"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type TenantData = {
  applicationId: string;
  status: string;
  tenantName: string;
  propertyAddress: string;
  rent: number | null;
  leaseSignedAt: string | null;
  signedLeasePdfUrl: string | null;
  leaseStartAt?: string | null;
  leaseEndAt?: string | null;
  documents: { type: string; fileUrl: string; createdAt: string }[];
  maintenance: { id: string; category: string; description: string; status: string; createdAt: string }[];
  payments: { id: string; amountCents: number; status: string; paidAt: string | null; createdAt: string }[];
};

type TabId = "overview" | "documents" | "payments" | "maintenance";

function PortalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idFromUrl = searchParams.get("id") ?? "";
  const [lookupValue, setLookupValue] = useState("");
  const [applicationId, setApplicationId] = useState(idFromUrl);
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const hasFetchedForId = useRef<string | null>(null);

  useEffect(() => {
    setApplicationId(idFromUrl);
  }, [idFromUrl]);

  useEffect(() => {
    if (!idFromUrl || hasFetchedForId.current === idFromUrl) return;
    setError("");
    setLoading(true);
    hasFetchedForId.current = idFromUrl;
    fetch(`/api/portal/${encodeURIComponent(idFromUrl)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          setData(null);
          hasFetchedForId.current = null;
          return;
        }
        setData(json);
      })
      .catch(() => {
        setError("Network error.");
        setData(null);
        hasFetchedForId.current = null;
      })
      .finally(() => setLoading(false));
  }, [idFromUrl]);

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = lookupValue.trim();
    if (!value) return;
    setError("");
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/portal/lookup?id=${encodeURIComponent(value)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Not found");
        return;
      }
      const appId = json.applicationId;
      if (appId) {
        router.replace(`/portal?id=${encodeURIComponent(appId)}`);
      }
    } catch {
      setError("Network error.");
    } finally {
      setLookupLoading(false);
    }
  };

  if (!idFromUrl) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Tenant portal</h1>
        <p className="text-sm text-slate-600">
          Enter your application ID or the email you used on your application to view your dashboard.
        </p>
        <form onSubmit={handleLookupSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
          <div>
            <label htmlFor="portal-lookup" className="mb-1 block text-sm font-medium text-slate-700">
              Application ID or email
            </label>
            <input
              id="portal-lookup"
              type="text"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
              placeholder="e.g. abc-123 or you@example.com"
              value={lookupValue}
              onChange={(e) => setLookupValue(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading}
            className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {lookupLoading ? "Loading…" : "View my dashboard"}
          </button>
        </form>
        <Link href="/" className="block text-center text-sm underline text-slate-600 py-3 px-3">← Back to home</Link>
      </main>
    );
  }

  if (loading || (idFromUrl && !data && !error)) {
    return (
      <main className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Loading…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Tenant portal</h1>
        <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>
        <button
          type="button"
          onClick={() => { router.replace("/portal"); hasFetchedForId.current = null; }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
        >
          Try again
        </button>
        <Link href="/" className="block text-sm underline text-slate-600 py-3 px-3">← Back to home</Link>
      </main>
    );
  }

  if (!data) return null;

  const statusBadge =
    data.status === "approved"
      ? "bg-green-100 text-green-800"
      : data.status === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "documents", label: "Documents" },
    { id: "payments", label: "Payments" },
    { id: "maintenance", label: "Maintenance" }
  ];

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold">Welcome back, {data.tenantName}</h1>
        <p className="mt-1 text-sm text-slate-600">{data.propertyAddress}</p>
        <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${statusBadge}`}>
          {data.status}
        </span>
      </div>

      <div className="border-b border-slate-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-2 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-black text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Overview</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {data.leaseStartAt && (
              <>
                <dt className="text-slate-500">Lease start</dt>
                <dd>{new Date(data.leaseStartAt).toLocaleDateString()}</dd>
              </>
            )}
            {data.leaseEndAt && (
              <>
                <dt className="text-slate-500">Lease end</dt>
                <dd>{new Date(data.leaseEndAt).toLocaleDateString()}</dd>
              </>
            )}
            <dt className="text-slate-500">Monthly rent</dt>
            <dd>{data.rent != null ? `$${data.rent.toLocaleString()}` : "—"}</dd>
          </dl>
          {data.leaseSignedAt && data.signedLeasePdfUrl && (
            <a
              href={data.signedLeasePdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download signed lease
            </a>
          )}
        </section>
      )}

      {activeTab === "documents" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Documents</h2>
          {data.documents.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No documents on file.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.documents.map((d, i) => (
                <li key={i}>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                    {d.type}
                  </a>
                  <span className="ml-2 text-xs text-slate-500">{new Date(d.createdAt).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "payments" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Payments</h2>
          {data.payments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No payment history yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {data.payments.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>${(p.amountCents / 100).toFixed(2)} — {p.status}</span>
                  <span className="text-slate-500">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/pay?applicationId=${encodeURIComponent(data.applicationId)}`}
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Pay rent or fees
          </Link>
        </section>
      )}

      {activeTab === "maintenance" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Maintenance</h2>
          {data.maintenance.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No requests yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {data.maintenance.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.category}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${m.status === "resolved" || m.status === "closed" ? "bg-slate-100" : "bg-amber-100"}`}>
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{m.description}</p>
                  <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleDateString()}</p>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/report?applicationId=${encodeURIComponent(data.applicationId)}`}
            className="mt-4 inline-block rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Submit new request
          </Link>
        </section>
      )}

      <button
        type="button"
        onClick={() => { router.replace("/portal"); setData(null); hasFetchedForId.current = null; }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
      >
        Sign out
      </button>
      <Link href="/" className="block text-sm underline text-slate-600 py-3 px-3">← Back to home</Link>
    </main>
  );
}

export default function PortalPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center"><p className="text-slate-500">Loading…</p></main>}>
      <PortalContent />
    </Suspense>
  );
}
