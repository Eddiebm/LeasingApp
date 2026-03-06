"use client";
export const runtime = "edge";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";

declare global {
  interface Window {
    Stripe?: (key: string) => {
      elements: (opts: { clientSecret: string }) => {
        create: (type: string) => { mount: (el: string) => void; unmount: () => void };
        getElement: (type: string) => unknown;
      };
      confirmSetup: (opts: {
        elements: { getElement: (t: string) => unknown };
        confirmParams: { return_url: string };
      }) => Promise<{ error?: { message: string } }>;
    };
  }
}

function AutopayContent() {
  const searchParams = useSearchParams();
  const rentScheduleId = searchParams.get("rentScheduleId") ?? "";
  const email = searchParams.get("email") ?? "";

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!rentScheduleId && !!email);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const elementsRef = useRef<{ getElement: (type: string) => unknown } | null>(null);

  useEffect(() => {
    if (!rentScheduleId || !email) {
      setLoading(false);
      setError("Missing rent schedule or email");
      return;
    }
    fetch("/api/autopay/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rentScheduleId, tenantEmail: email })
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setClientSecret(data.clientSecret);
          setStripeCustomerId(data.stripeCustomerId ?? null);
        }
      })
      .catch(() => setError("Failed to start setup"))
      .finally(() => setLoading(false));
  }, [rentScheduleId, email]);

  useEffect(() => {
    if (!clientSecret || !stripeReady || !window.Stripe) return;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) return;
    const stripe = window.Stripe(publishableKey);
    const elements = stripe.elements({ clientSecret });
    elementsRef.current = elements;
    const paymentElement = elements.create("payment");
    paymentElement.mount("#autopay-element");
    return () => {
      paymentElement.unmount();
      elementsRef.current = null;
    };
  }, [clientSecret, stripeReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientSecret || !stripeCustomerId || !elementsRef.current) return;
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!window.Stripe || !publishableKey) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const returnUrl = new URL("/pay/autopay/success", origin);
    returnUrl.searchParams.set("rentScheduleId", rentScheduleId);
    returnUrl.searchParams.set("email", email);
    returnUrl.searchParams.set("stripeCustomerId", stripeCustomerId);
    setSubmitting(true);
    try {
      const stripe = window.Stripe(publishableKey);
      const { error: confirmError } = await stripe.confirmSetup({
        elements: elementsRef.current,
        confirmParams: { return_url: returnUrl.toString() }
      });
      if (confirmError) setError(confirmError.message ?? "Setup failed");
    } catch {
      setError("Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <p className="text-slate-600">Loading…</p>
      </main>
    );
  }

  if (error && !clientSecret) {
    return (
      <main className="mx-auto max-w-lg space-y-6 px-4 py-12">
        <h1 className="text-xl font-semibold">Set up autopay</h1>
        <p className="text-slate-600">{error}</p>
        <Link href="/" className="text-sm text-blue-600 underline">Back to home</Link>
      </main>
    );
  }

  if (!clientSecret) return null;

  return (
    <>
      <Script src="https://js.stripe.com/v3/" onLoad={() => setStripeReady(true)} />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-8">
        <h1 className="text-2xl font-bold">Set up autopay</h1>
        <p className="text-slate-600">Save a payment method to pay rent automatically each month.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div id="autopay-element" className="rounded-lg border border-slate-200 bg-white p-3" />
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save payment method"}
          </button>
        </form>
        <p className="text-center text-xs text-slate-500">🔒 Secured by Stripe</p>
        <Link href="/" className="block text-center text-sm text-slate-600 underline">Back to home</Link>
      </main>
    </>
  );
}

export default function AutopayPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[40vh] items-center justify-center"><p className="text-slate-500">Loading…</p></main>}>
      <AutopayContent />
    </Suspense>
  );
}
