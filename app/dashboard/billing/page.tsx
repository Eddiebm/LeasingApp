"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

type LandlordBilling = {
  company_name: string | null;
  slug: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [landlord, setLandlord] = useState<LandlordBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/dashboard/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.landlord) setLandlord(data.landlord);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const handleSubscribe = async () => {
    if (!session?.access_token) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not start checkout.");
    } catch (e) {
      console.error(e);
      alert("Something went wrong.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManage = async () => {
    if (!session?.access_token) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/create-portal-session", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not open billing portal.");
    } catch (e) {
      console.error(e);
      alert("Something went wrong.");
    } finally {
      setPortalLoading(false);
    }
  };

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  if (!session && !loading) {
    router.replace("/dashboard/login");
    return null;
  }

  const dashboardTitle = landlord?.company_name ? `${landlord.company_name} – Billing` : "Billing";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
          <p className="text-sm text-slate-600">Manage your subscription.</p>
        </div>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Back to dashboard
        </Link>
      </div>

      {success === "1" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Subscription started. You can manage it below.
        </div>
      )}
      {canceled === "1" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Checkout was canceled.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            <h2 className="mb-4 text-sm font-semibold text-slate-800">Subscription</h2>
            {landlord?.subscription_status && landlord.subscription_status !== "inactive" && landlord.subscription_status !== "canceled" ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Status: <span className="font-medium capitalize">{landlord.subscription_status}</span>
                </p>
                {landlord.subscription_current_period_end && (
                  <p className="text-sm text-slate-600">
                    Current period ends:{" "}
                    {new Date(landlord.subscription_current_period_end).toLocaleDateString()}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleManage}
                  disabled={portalLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {portalLoading ? "Opening…" : "Manage subscription"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">You don’t have an active subscription.</p>
                <button
                  type="button"
                  onClick={handleSubscribe}
                  disabled={checkoutLoading}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {checkoutLoading ? "Redirecting…" : "Subscribe"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
