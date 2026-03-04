"use client";

import { useState } from "react";
import Link from "next/link";

type TenantData = {
  applicationId: string;
  status: string;
  tenantName: string;
  propertyAddress: string;
  rent: number | null;
  leaseSignedAt: string | null;
  signedLeasePdfUrl: string | null;
  documents: { type: string; fileUrl: string; createdAt: string }[];
  maintenance: { id: string; category: string; description: string; status: string; createdAt: string }[];
  payments: { id: string; amountCents: number; status: string; paidAt: string | null; createdAt: string }[];
};

export default function PortalPage() {
  const [email, setEmail] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tenant/me?applicationId=${encodeURIComponent(applicationId.trim())}&email=${encodeURIComponent(email.trim().toLowerCase())}`
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not load your information.");
        setData(null);
        return;
      }
      setData(json);
    } catch {
      setError("Network error.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  if (data) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Tenant portal</h1>
        <p className="text-sm text-slate-600">{data.tenantName} – {data.propertyAddress}</p>
        <p className="text-xs text-slate-500">Application status: {data.status}</p>

        {data.signedLeasePdfUrl && (
          <section>
            <h2 className="text-lg font-semibold">Lease</h2>
            <a href={data.signedLeasePdfUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              View signed lease (PDF)
            </a>
          </section>
        )}

        <section>
          <h2 className="text-lg font-semibold">Documents</h2>
          {data.documents.length === 0 ? (
            <p className="text-sm text-slate-500">No documents on file.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.documents.map((d, i) => (
                <li key={i}>
                  <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{d.type}</a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Maintenance requests</h2>
          {data.maintenance.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {data.maintenance.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-200 p-2">
                  <span className="font-medium">{m.category}</span> – {m.status}
                  <p className="text-slate-600">{m.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Payments</h2>
          {data.payments.length === 0 ? (
            <p className="text-sm text-slate-500">No payment history yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {data.payments.map((p) => (
                <li key={p.id}>
                  ${(p.amountCents / 100).toFixed(2)} – {p.status}
                  {p.paidAt && ` (${new Date(p.paidAt).toLocaleDateString()})`}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-slate-600">
            <a href={`/pay?applicationId=${encodeURIComponent(data.applicationId)}`} className="font-medium text-blue-600 underline">
              Pay rent or fees
            </a>
          </p>
        </section>

        <button type="button" onClick={() => setData(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700">
          Sign out
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Tenant portal</h1>
      <p className="text-sm text-slate-600">
        Sign in with the email you used on your application and your application ID (from your confirmation).
      </p>
      <form onSubmit={handleLogin} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>}
        <div>
          <label htmlFor="portal-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="portal-email"
            type="email"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="portal-app-id" className="mb-1 block text-sm font-medium text-slate-700">Application ID</label>
          <input
            id="portal-app-id"
            type="text"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            placeholder="From your confirmation"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Loading…" : "View my information"}
        </button>
      </form>
      <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
    </main>
  );
}
