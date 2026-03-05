"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";
  const email = searchParams.get("email") ?? "";

  return (
    <main className="space-y-6">
      <div className="rounded-2xl bg-emerald-50 p-6 text-center">
        <h1 className="text-2xl font-bold text-emerald-800">Application received</h1>
        <p className="mt-3 text-slate-700">
          We've received your application. You'll hear from us within 2–3 business days.
        </p>
        {applicationId && (
          <p className="mt-4 rounded-lg bg-white/80 px-4 py-2 font-mono text-sm text-slate-800">
            Application ID: <strong>{applicationId}</strong>
          </p>
        )}
      </div>
      <p className="text-center text-sm text-slate-600">
        We sent a confirmation to your email. You can check your status anytime at the tenant portal.
      </p>
      <div className="flex flex-col items-center gap-3">
        {applicationId && email && (
          <Link
            href={`/portal?id=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}`}
            className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Check my status
          </Link>
        )}
        <Link href="/" className="text-sm text-slate-600 underline hover:no-underline">
          Back to home
        </Link>
      </div>
    </main>
  );
}

export default function ApplySuccessPage() {
  return (
    <Suspense fallback={<main className="space-y-6"><p className="text-slate-600">Loading…</p></main>}>
      <SuccessContent />
    </Suspense>
  );
}
