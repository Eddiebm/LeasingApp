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

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Next steps</h2>
        <ol className="space-y-2 text-sm text-slate-700">
          <li>
            <span className="font-medium">Step 1 – Application submitted</span> · you’re done.
          </li>
          {applicationId && (
            <>
              <li>
                <span className="font-medium">Step 2 – Screening (optional)</span>{" "}
                · pay the screening fee so your landlord can see a Tenant Passport.
                <div className="mt-1">
                  <Link
                    href={`/apply/screening-payment?applicationId=${encodeURIComponent(applicationId)}`}
                    className="inline-flex items-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    Pay screening fee
                  </Link>
                </div>
              </li>
              <li>
                <span className="font-medium">Step 3 – Upload documents</span>{" "}
                · add ID and income documents for your landlord.
                <div className="mt-1">
                  <Link
                    href={`/apply/documents?applicationId=${encodeURIComponent(applicationId)}`}
                    className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
                  >
                    Upload documents
                  </Link>
                </div>
              </li>
            </>
          )}
        </ol>
      </section>

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
