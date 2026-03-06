"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AutopaySuccessContent() {
  const searchParams = useSearchParams();
  const rentScheduleId = searchParams.get("rentScheduleId") ?? "";
  const stripeCustomerId = searchParams.get("stripeCustomerId") ?? "";
  const setupIntentId = searchParams.get("setup_intent") ?? "";
  const redirectStatus = searchParams.get("redirect_status") ?? "";

  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (redirectStatus !== "succeeded" || !setupIntentId || !rentScheduleId || !stripeCustomerId) {
      setConfirmed(false);
      if (redirectStatus && redirectStatus !== "succeeded") setError("Setup was not completed.");
      return;
    }
    fetch("/api/autopay/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rentScheduleId,
        stripeCustomerId,
        setupIntentId
      })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setConfirmed(true);
      })
      .catch(() => setError("Failed to complete setup"))
      .finally(() => {});
  }, [redirectStatus, setupIntentId, rentScheduleId, stripeCustomerId]);

  if (confirmed === null && !error) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <p className="text-slate-600">Completing setup…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <h1 className="text-xl font-semibold">Setup incomplete</h1>
        <p className="text-slate-600">{error}</p>
        <Link href="/" className="text-sm text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div className="rounded-2xl bg-emerald-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-emerald-800">✓ Autopay set up</h1>
        <p className="mt-2 text-slate-700">Rent will be charged automatically each month.</p>
      </div>
      <Link href="/" className="block text-center text-sm text-blue-600 underline">Back to home</Link>
    </main>
  );
}

export default function AutopaySuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[40vh] items-center justify-center"><p className="text-slate-500">Loading…</p></main>}>
      <AutopaySuccessContent />
    </Suspense>
  );
}
