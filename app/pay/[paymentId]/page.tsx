"use client";
export const runtime = "edge";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import { useParams } from "next/navigation";

declare global {
  interface Window {
    Stripe?: (key: string) => {
      elements: (opts: { clientSecret: string }) => {
        create: (type: string) => { mount: (el: string) => void; unmount: () => void };
        getElement: (type: string) => unknown;
      };
      confirmPayment: (opts: { elements: { getElement: (t: string) => unknown }; confirmParams: { return_url: string; receipt_email?: string } }) => Promise<{ error?: { message: string } }>;
    };
  }
}

type PaymentDetails = {
  id: string;
  amount: number;
  lateFee: number;
  platformFeeAchCents: number;
  platformFeeCardCents: number;
  totalCents: number;
  totalWithAchCents: number;
  totalWithCardCents: number;
  currency: string;
  period: string;
  propertyAddress: string;
  tenantEmail: string | null;
  status: string;
  paidAt: string | null;
};

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function PayRentContent() {
  const params = useParams();
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : "";

  const [details, setDetails] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(!!paymentId);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"ach" | "card">("ach");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const elementsRef = useRef<{ getElement: (type: string) => unknown } | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setLoading(false);
      return;
    }
    fetch(`/api/rent-payments/${paymentId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setDetails(null);
        } else {
          setDetails(data);
        }
      })
      .catch(() => setError("Failed to load payment"))
      .finally(() => setLoading(false));
  }, [paymentId]);

  const createIntent = async () => {
    if (!paymentId || !details || details.status !== "pending") return;
    setPayError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rent-payments/${paymentId}/create-intent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setClientSecret(data.clientSecret);
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!clientSecret || !stripeReady || !window.Stripe) return;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) return;
    const stripe = window.Stripe(publishableKey);
    const elements = stripe.elements({ clientSecret });
    elementsRef.current = elements;
    const paymentElement = elements.create("payment");
    paymentElement.mount("#payment-element");
    return () => {
      paymentElement.unmount();
      elementsRef.current = null;
    };
  }, [clientSecret, stripeReady]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSecret || !details || !elementsRef.current) return;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!window.Stripe || !publishableKey) {
      setPayError("Stripe not loaded");
      return;
    }
    setSubmitting(true);
    setPayError(null);
    const stripe = window.Stripe(publishableKey);
    try {
      const { error: confirmError } = await stripe.confirmPayment({
        elements: elementsRef.current,
        confirmParams: {
          return_url: `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${paymentId}/success`,
          receipt_email: details.tenantEmail ?? undefined
        }
      });
      if (confirmError) setPayError(confirmError.message ?? "Payment failed");
    } catch {
      setPayError("Payment failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || (!details && !error)) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error || !details) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <h1 className="text-xl font-semibold">Rent payment</h1>
        <p className="text-slate-600">{error ?? "Payment not found."}</p>
        <Link href="/" className="text-sm text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  if (details.status === "succeeded") {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <div className="rounded-2xl bg-emerald-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-emerald-800">✓ Payment received</h1>
          <p className="mt-2 text-slate-700">
            {formatCents(details.totalCents, details.currency)} paid for {details.period}
          </p>
          {details.tenantEmail && (
            <p className="mt-1 text-sm text-slate-600">A receipt has been sent to {details.tenantEmail}</p>
          )}
        </div>
        <Link href="/" className="block text-center text-sm text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  const totalWithFee = paymentMethod === "ach" ? details.totalWithAchCents : details.totalWithCardCents;
  const feeCents = paymentMethod === "ach" ? details.platformFeeAchCents : details.platformFeeCardCents;

  return (
    <>
      <Script src="https://js.stripe.com/v3/" onLoad={() => setStripeReady(true)} />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">Rent payment</h1>
        <p className="text-sm text-slate-600">{details.propertyAddress}</p>
        <p className="text-sm text-slate-600">Period: {details.period}</p>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-slate-700">Rent: {formatCents(details.totalCents, details.currency)}</p>
          <p className="mt-1 text-sm text-slate-600">
            Processing fee: {formatCents(feeCents, details.currency)} ({paymentMethod === "ach" ? "ACH" : "card"})
          </p>
          <p className="mt-2 font-semibold">Total: {formatCents(totalWithFee, details.currency)}</p>
        </div>

        {!clientSecret ? (
          <form onSubmit={(e) => { e.preventDefault(); createIntent(); }} className="space-y-4">
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Payment method</legend>
              <div className="mt-2 space-y-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="method"
                    checked={paymentMethod === "ach"}
                    onChange={() => setPaymentMethod("ach")}
                    className="rounded border-slate-300"
                  />
                  <span>Bank transfer (ACH) — {formatCents(details.platformFeeAchCents, details.currency)} fee</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="method"
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                    className="rounded border-slate-300"
                  />
                  <span>Credit/debit card — 3.5% fee</span>
                </label>
              </div>
            </fieldset>
            {payError && <p className="text-sm text-red-600" role="alert">{payError}</p>}
            <button
              type="submit"
              disabled={submitting || details.status !== "pending"}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Preparing…" : "Pay with Stripe"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm} className="space-y-4">
            <div id="payment-element" className="rounded-lg border border-slate-200 bg-white p-3" />
            {payError && <p className="text-sm text-red-600" role="alert">{payError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "Processing…" : "Pay"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">🔒 Payments secured by Stripe</p>
        <Link href="/" className="block text-center text-sm text-slate-600 underline">Back to home</Link>
      </main>
    </>
  );
}

export default function PayRentPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[40vh] items-center justify-center"><p className="text-slate-500">Loading…</p></main>}>
      <PayRentContent />
    </Suspense>
  );
}
