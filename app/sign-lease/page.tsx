"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type LeaseInfo = {
  applicationId: string;
  tenantName: string;
  propertyAddress: string;
  rent: number | null;
  leasePdfUrl: string | null;
  signed: boolean;
  signedAt: string | null;
  signedPdfUrl: string | null;
};

function SignLeaseContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");
  const email = searchParams.get("email");
  const token = searchParams.get("token");

  const [leaseInfo, setLeaseInfo] = useState<LeaseInfo | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(!!(applicationId && email) || !!token);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const useAppIdEmail = applicationId && email;

  useEffect(() => {
    if (useAppIdEmail) {
      fetch(
        `/api/tenant/lease?applicationId=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email!)}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.signed) {
            setSigned(true);
            setLeaseInfo(data);
          } else {
            setLeaseInfo(data);
          }
        })
        .catch(() => setError("Invalid link or access denied"))
        .finally(() => setLoading(false));
    } else if (token) {
      fetch(`/api/sign-lease?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.signed) {
            setSigned(true);
            setLeaseInfo({
              applicationId: "",
              tenantName: data.tenantName ?? "",
              propertyAddress: data.propertyAddress ?? "",
              rent: null,
              leasePdfUrl: null,
              signed: true,
              signedAt: null,
              signedPdfUrl: data.signedPdfUrl ?? null
            });
          } else {
            setLeaseInfo({
              applicationId: "",
              tenantName: data.tenantName ?? "",
              propertyAddress: data.propertyAddress ?? "",
              rent: null,
              leasePdfUrl: null,
              signed: false,
              signedAt: null,
              signedPdfUrl: null
            });
          }
        })
        .catch(() => setError("Invalid link"))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
      setError("Missing application ID and email. Use the link from your email.");
    }
  }, [applicationId, email, token, useAppIdEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Please type your full legal name");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (useAppIdEmail && applicationId && email) {
        const res = await fetch(`/api/applications/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            signature: fullName.trim(),
            signed_at: new Date().toISOString(),
            email: email.trim()
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit");
        setSigned(true);
      } else if (token) {
        const res = await fetch("/api/sign-lease", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, signature: fullName.trim() })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to submit");
        setSigned(true);
        setLeaseInfo((prev) => (prev ? { ...prev, signed: true, signedPdfUrl: data.signedPdfUrl ?? null } : null));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (error && !leaseInfo) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Sign Lease</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Link href="/portal" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to portal
        </Link>
      </main>
    );
  }

  if (signed && leaseInfo) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-emerald-800">Lease signed</h1>
          <p className="mt-2 text-slate-700">Thank you. Your signature has been recorded.</p>
          {leaseInfo.signedPdfUrl && (
            <a
              href={leaseInfo.signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Download signed lease
            </a>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href="/portal" className="underline">Back to portal</Link>
        </p>
      </main>
    );
  }

  if (!leaseInfo) return null;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Review and sign your lease</h1>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Lease details</h2>
        {leaseInfo.tenantName && <p className="mt-1 text-sm text-slate-700">Tenant: {leaseInfo.tenantName}</p>}
        {leaseInfo.propertyAddress && <p className="text-sm text-slate-700">Property: {leaseInfo.propertyAddress}</p>}
        {leaseInfo.rent != null && <p className="text-sm text-slate-700">Monthly rent: ${leaseInfo.rent}</p>}
      </section>

      {leaseInfo.leasePdfUrl && (
        <p className="text-sm text-slate-600">
          <a
            href={leaseInfo.leasePdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 underline"
          >
            View full lease (PDF)
          </a>
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signature-name" className="block text-sm font-medium text-slate-700">
            Type your full legal name to sign
          </label>
          <input
            id="signature-name"
            type="text"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            placeholder="Full legal name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[48px] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Sign lease"}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        By signing, you agree to the lease terms above and in the linked document.
      </p>
    </main>
  );
}

export default function SignLeasePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-slate-600">Loading…</p>
        </div>
      }
    >
      <SignLeaseContent />
    </Suspense>
  );
}
