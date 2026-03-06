"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type ValidateResponse = {
  valid: boolean;
  expired: boolean;
  alreadySigned: boolean;
  signedAt?: string | null;
  tenantName: string;
  propertyAddress: string;
  leaseContent: string;
  leasePdfUrl: string;
};

function SignLeaseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<"loading" | "invalid" | "expired" | "already_signed" | "review" | "success">("loading");
  const [data, setData] = useState<ValidateResponse | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [canSign, setCanSign] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, clientHeight, scrollHeight } = el;
    setCanSign(scrollTop + clientHeight >= scrollHeight - 10);
  }, []);

  useEffect(() => {
    if (!token.trim()) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/sign-lease/validate?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((res: ValidateResponse) => {
        setData(res);
        if (res.alreadySigned) {
          setStatus("already_signed");
          return;
        }
        if (res.expired || !res.valid) {
          setStatus(res.expired ? "expired" : "invalid");
          return;
        }
        setStatus("review");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || status !== "review") return;
    checkScroll();
    el.addEventListener("scroll", checkScroll);
    return () => el.removeEventListener("scroll", checkScroll);
  }, [status, checkScroll]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !canSign || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/sign-lease/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signedByName: fullName.trim() })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to sign");
      setSignedPdfUrl(json.signedPdfUrl ?? null);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <main className="mx-auto flex max-w-lg min-h-[40vh] items-center justify-center px-4 py-12">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (status === "invalid" || status === "expired") {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Sign Lease</h1>
        <p className="mt-2 text-slate-600">
          This signing link has expired or is invalid. Contact your landlord for a new link.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (status === "already_signed" && data) {
    const signedDate = data.signedAt ? new Date(data.signedAt).toLocaleDateString() : "";
    return (
      <main className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Lease already signed</h1>
        <p className="mt-2 text-slate-600">
          This lease has already been signed{signedDate ? ` on ${signedDate}` : ""}.
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to home
        </Link>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-emerald-800">✓ Lease signed successfully</h1>
          <p className="mt-2 text-slate-700">
            Your signed lease has been sent to your email. A copy has also been sent to your landlord.
          </p>
          {signedPdfUrl && (
            <a
              href={signedPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Download signed lease (PDF)
            </a>
          )}
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          <Link href="/" className="underline">Back to home</Link>
        </p>
      </main>
    );
  }

  if (status !== "review" || !data) return null;

  const hasScrollableContent = data.leaseContent.length > 0;

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Lease agreement</h1>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-800">{data.propertyAddress}</p>
        {data.tenantName && (
          <p className="text-sm text-slate-600">Prepared for: {data.tenantName}</p>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold text-slate-800">Lease content</h2>
        {hasScrollableContent ? (
          <div
            ref={scrollRef}
            className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-left text-sm text-slate-700 whitespace-pre-wrap"
          >
            {data.leaseContent}
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700"
          >
            <p className="mb-2">Please read the full lease document before signing.</p>
            {data.leasePdfUrl && (
              <p className="mb-4">
                <a
                  href={data.leasePdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-blue-600 underline"
                >
                  View full lease (PDF)
                </a>
              </p>
            )}
            <p className="mb-2">By signing below, you confirm that you have read and agree to the terms of this lease agreement.</p>
            <p className="mb-2">Your signature indicates your acceptance of all terms and conditions contained in the lease document.</p>
            <p className="mb-2">This document will be stored and may be used as evidence of your agreement.</p>
            <p className="mb-2">If you have not read the full lease, please open the PDF link above and review it before signing.</p>
            <p className="mb-2">Scroll to the bottom of this box to enable the sign button.</p>
          </div>
        )}
      </div>

      <p className="text-sm text-slate-600">
        By signing, you confirm you have read and agree to the terms of this lease agreement.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signature-name" className="block text-sm font-medium text-slate-700">
            Your full legal name
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
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <button
          type="submit"
          disabled={!canSign || !fullName.trim() || submitting}
          className="w-full min-h-[48px] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Signing…" : "Sign lease agreement"}
        </button>
      </form>

      {!canSign && (
        <p className="text-center text-xs text-slate-500">
          Scroll to the bottom of the lease content above to enable the sign button.
        </p>
      )}

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="underline">Back to home</Link>
      </p>
    </main>
  );
}

export default function SignLeasePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center">
          <p className="text-slate-600">Loading…</p>
        </main>
      }
    >
      <SignLeaseContent />
    </Suspense>
  );
}
