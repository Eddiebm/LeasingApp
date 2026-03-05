"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Script from "next/script";

declare global {
  interface Window {
    Stripe?: (key: string) => {
      confirmCardPayment: (clientSecret: string, options: { payment_method: { card: unknown } }) => Promise<{ error?: { message: string }; paymentIntent?: { status: string } }>;
      elements: () => { create: (type: string) => unknown };
    };
  }
}

function PayContent() {
  const searchParams = useSearchParams();
  const [applicationId, setApplicationId] = useState(() => searchParams.get("applicationId") ?? "");
  const [email, setEmail] = useState(() => searchParams.get("email") ?? "");
  const [amountCents, setAmountCents] = useState(0);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const cardElementRef = useRef<unknown>(null);

  const amountDollars = amountCents / 100;
  const minCents = 50;
  const publishableKey =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY : undefined;

  useEffect(() => {
    if (!applicationId || !email || amountCents > 0) return;
    fetch(
      `/api/tenant/me?applicationId=${encodeURIComponent(applicationId)}&email=${encodeURIComponent(email)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.rent != null && data.rent > 0) {
          setAmountCents(Math.round(Number(data.rent) * 100));
        }
      })
      .catch(() => {});
  }, [applicationId, email, amountCents]);

  const createIntent = async () => {
    if (!applicationId || !email || amountCents < minCents) {
      setError("Enter application ID, email, and amount (min $0.50).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, amountCents })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");
      setClientSecret(data.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSecret || !window.Stripe || !cardElementRef.current) return;
    setLoading(true);
    setError(null);
    const stripe = window.Stripe(publishableKey || "");
    try {
      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElementRef.current }
      });
      if (confirmError) {
        setError(confirmError.message ?? "Payment failed");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Payment failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientSecret || !stripeReady || !window.Stripe) return;
    const stripe = window.Stripe(publishableKey || "");
    const elements = stripe.elements();
    const card = elements.create("card");
    const el = document.getElementById("card-element");
    if (el) {
      (card as { mount: (el: HTMLElement) => void }).mount(el);
      cardElementRef.current = card;
    }
    return () => {
      (card as { unmount: () => void }).unmount();
      cardElementRef.current = null;
    };
  }, [clientSecret, stripeReady, publishableKey]);

  return (
    <>
      <Script
        src="https://js.stripe.com/v3/"
        onLoad={() => setStripeReady(true)}
      />
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Pay rent</h1>
        <p className="text-sm text-slate-600">
          Enter your application ID and email, then the amount to pay. Your rent may be pre-filled.
        </p>

        {!clientSecret ? (
          <form onSubmit={(e) => { e.preventDefault(); createIntent(); }} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <div>
              <label htmlFor="applicationId" className="block text-sm font-medium text-slate-700">Application ID</label>
              <input
                id="applicationId"
                type="text"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
                placeholder="From your confirmation email"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 min-h-[48px]"
              />
            </div>
            <div>
              <label htmlFor="pay-email" className="block text-sm font-medium text-slate-700">Email</label>
              <input
                id="pay-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email on your application"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 min-h-[48px]"
              />
            </div>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-slate-700">Amount due (USD)</label>
              <input
                id="amount"
                type="number"
                min="0.50"
                step="0.01"
                value={amountDollars > 0 ? amountDollars : ""}
                onChange={(e) => setAmountCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 min-h-[48px]"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !applicationId || !email || amountCents < minCents}
              className="w-full min-h-[48px] rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Preparing…" : "Pay Now"}
            </button>
          </form>
        ) : success ? (
          <div className="rounded-2xl bg-emerald-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-emerald-800">Payment received</h2>
            <p className="mt-2 text-slate-700">Thank you. Your payment was successful.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Card</label>
              <div id="card-element" className="mt-1 rounded-lg border border-slate-300 bg-white p-3" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Processing…" : "Pay"}
            </button>
          </form>
        )}
      </main>
    </>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<main className="space-y-6"><h1 className="text-2xl font-bold">Pay</h1><p className="text-slate-600">Loading…</p></main>}>
      <PayContent />
    </Suspense>
  );
}
