"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Script from "next/script";

declare global {
  interface Window {
    Stripe?: (key: string) => {
      confirmCardPayment: (clientSecret: string, options: { payment_method: { card: unknown } }) => Promise<{ error?: { message: string }; paymentIntent?: { status: string } }>;
      elements: () => { create: (type: string) => unknown };
    };
  }
}

function ScreeningPaymentContent() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId") ?? "";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amountCents, setAmountCents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const cardElementRef = useRef<unknown>(null);

  const amountDollars = amountCents / 100;

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    fetch("/api/payments/create-screening-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId })
    })
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setAmountCents(data.amountCents ?? 3500);
        } else if (!ok && data.error?.includes("already paid")) {
          setError("Screening fee already paid for this application.");
        } else {
          setError(data.error || "Could not start payment");
        }
      })
      .catch(() => setError("Could not load payment"))
      .finally(() => setLoading(false));
  }, [applicationId]);

  useEffect(() => {
    if (!clientSecret || !stripeReady || !window.Stripe) return;
    const stripe = window.Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
    const elements = stripe.elements();
    const card = elements.create("card");
    const el = document.getElementById("screening-card-element");
    if (el) {
      (card as { mount: (el: HTMLElement) => void }).mount(el);
      cardElementRef.current = card;
    }
    return () => {
      try {
        (card as { unmount: () => void }).unmount();
      } catch {}
      cardElementRef.current = null;
    };
  }, [clientSecret, stripeReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSecret || !window.Stripe || !cardElementRef.current) return;
    setLoading(true);
    setError(null);
    const stripe = window.Stripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
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

  if (!applicationId) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Screening payment</h1>
        <p className="text-slate-600">Missing application ID. Please start from the application form.</p>
        <Link href="/apply" className="text-sm underline text-slate-600">Back to application</Link>
      </main>
    );
  }

  return (
    <>
      <Script src="https://js.stripe.com/v3/" onLoad={() => setStripeReady(true)} />
      <main className="space-y-6 pb-8">
        <h1 className="text-2xl font-bold">Pay for tenant screening</h1>
        <p className="text-sm text-slate-600">
          A one-time screening fee covers your background and credit check. The landlord will receive the results after payment.
        </p>

        {loading && !clientSecret && <p className="text-slate-600">Loading…</p>}
        {error && !clientSecret && (
          <>
            <p className="text-sm text-slate-700">{error}</p>
            <Link href={`/apply/documents?applicationId=${applicationId}`} className="mt-2 inline-block text-sm font-medium underline text-slate-600">
              Continue to document upload
            </Link>
          </>
        )}

        {clientSecret && success ? (
          <div className="rounded-2xl bg-emerald-50 p-5">
            <p className="font-medium text-emerald-800">Payment received.</p>
            <p className="mt-1 text-sm text-slate-700">
              Your screening will be processed shortly. You can upload documents while you wait.
            </p>
            <Link
              href={`/apply/documents?applicationId=${applicationId}`}
              className="mt-4 inline-block rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              Upload documents
            </Link>
          </div>
        ) : clientSecret && stripeReady ? (
          <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-800">
              Amount: ${amountDollars.toFixed(2)} (screening fee)
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Card</label>
              <div id="screening-card-element" className="min-h-[48px] rounded-lg border border-slate-300 bg-white p-3" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50 touch-manipulation"
            >
              {loading ? "Processing…" : "Pay screening fee"}
            </button>
            <p className="text-center text-xs text-slate-500">
              <Link href={`/apply/documents?applicationId=${applicationId}`} className="underline">
                Skip for now and upload documents
              </Link>
            </p>
          </form>
        ) : null}

        <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
      </main>
    </>
  );
}

export default function ScreeningPaymentPage() {
  return (
    <Suspense fallback={<main className="p-6 text-slate-600">Loading…</main>}>
      <ScreeningPaymentContent />
    </Suspense>
  );
}
