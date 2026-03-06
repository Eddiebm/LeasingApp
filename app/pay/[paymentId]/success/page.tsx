"use client";
export const runtime = "edge";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

type PaymentDetails = {
  id: string;
  rentScheduleId: string | null;
  totalCents: number;
  currency: string;
  period: string;
  tenantEmail: string | null;
  status: string;
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function SuccessContent() {
  const params = useParams();
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : "";
  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(!!paymentId);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    fetch(`/api/rent-payments/${paymentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setDetails(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
      <div className="rounded-2xl bg-emerald-50 p-6 text-center">
        <h1 className="text-xl font-semibold text-emerald-800">✓ Payment received</h1>
        {details && (
          <>
            <p className="mt-2 text-slate-700">
              {formatCents(details.totalCents, details.currency)} paid for {details.period}
            </p>
            {details.tenantEmail && (
              <p className="mt-1 text-sm text-slate-600">A receipt has been sent to {details.tenantEmail}</p>
            )}
          </>
        )}
        {!details && (
          <p className="mt-2 text-slate-700">Your payment was successful.</p>
        )}
      </div>
      {details?.rentScheduleId && details?.tenantEmail && (
        <p className="mt-4 text-center">
          <Link
            href={`/pay/autopay?rentScheduleId=${encodeURIComponent(details.rentScheduleId)}&email=${encodeURIComponent(details.tenantEmail)}`}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Set up autopay for future months
          </Link>
        </p>
      )}
      <Link href="/" className="block text-center text-sm text-blue-600 underline">Back to home</Link>
    </main>
  );
}

export default function PayRentSuccessPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[40vh] items-center justify-center"><p className="text-slate-500">Loading…</p></main>}>
      <SuccessContent />
    </Suspense>
  );
}
