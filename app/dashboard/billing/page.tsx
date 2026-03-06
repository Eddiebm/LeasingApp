"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useSubscription } from "../../../components/SubscriptionContext";

type LandlordBilling = {
  company_name: string | null;
  slug: string | null;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
  stripe_connect_account_id?: string | null;
  stripe_connect_onboarded?: boolean | null;
  stripe_connect_charges_enabled?: boolean | null;
  stripe_connect_payouts_enabled?: boolean | null;
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { country } = useSubscription();
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [landlord, setLandlord] = useState<LandlordBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<"gbp" | "usd" | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectStatus, setConnectStatus] = useState<{ chargesEnabled: boolean; payoutsEnabled: boolean; onboarded: boolean } | null>(null);
  const [leasesPerYear, setLeasesPerYear] = useState<1 | 2 | 3 | 5>(1);

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

  useEffect(() => {
    if (!session?.access_token || !landlord?.stripe_connect_account_id) return;
    fetch("/api/connect/status", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.chargesEnabled !== undefined) setConnectStatus({ chargesEnabled: data.chargesEnabled, payoutsEnabled: data.payoutsEnabled, onboarded: data.onboarded });
      })
      .catch(() => {});
  }, [session?.access_token, landlord?.stripe_connect_account_id]);

  const handleSubscribe = async (currency: "gbp" | "usd") => {
    if (!session?.access_token) return;
    setCheckoutLoading(currency);
    try {
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currency }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not start checkout.");
    } catch (e) {
      console.error(e);
      alert("Something went wrong.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleConnectBank = async () => {
    if (!session?.access_token) return;
    setConnectLoading(true);
    try {
      if (!landlord?.stripe_connect_account_id) {
        const createRes = await fetch("/api/connect/create-account", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        const createData = await createRes.json().catch(() => ({}));
        if (!createRes.ok && createData.error?.includes("already exists")) {
          // refresh landlord and get link
        } else if (!createRes.ok) {
          alert(createData.error || "Could not create account.");
          return;
        }
      }
      const linkRes = await fetch("/api/connect/onboarding-link", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (linkData.url) window.location.href = linkData.url;
      else alert(linkData.error || "Could not get onboarding link.");
    } catch (e) {
      console.error(e);
      alert("Something went wrong.");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleStripeDashboard = async () => {
    if (!session?.access_token) return;
    setConnectLoading(true);
    try {
      const res = await fetch("/api/connect/dashboard-link", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Could not open Stripe dashboard.");
    } catch (e) {
      console.error(e);
      alert("Something went wrong.");
    } finally {
      setConnectLoading(false);
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
  const savingsPerLease = 200; // 200 in local currency
  const yearlySavings = leasesPerYear * savingsPerLease;
  const paysForItselfMonths = Math.max(1, Math.round(7 / leasesPerYear)); // 1 lease ~7 months of Pro
  const currencySymbol = country === "US" ? "$" : "£";

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

      {searchParams.get("connect") === "success" && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Bank account connected. You can now collect rent through the platform.
        </div>
      )}
      {searchParams.get("connect") === "refresh" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Onboarding expired or was refreshed. You can start again below.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Rent collection</h2>
        <p className="mt-1 text-sm text-slate-600">
          To collect rent through Bannerman Leasing, connect your bank account via Stripe.
        </p>
        {(connectStatus?.onboarded || landlord?.stripe_connect_onboarded) ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-emerald-700">✓ Bank account connected</p>
            <p className="text-sm text-slate-600">
              Payouts enabled · Charges enabled
            </p>
            <button
              type="button"
              onClick={handleStripeDashboard}
              disabled={connectLoading}
              className="mt-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {connectLoading ? "Opening…" : "View Stripe Dashboard →"}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <ul className="text-sm text-slate-700 space-y-1">
              <li>✓ Secure — bank details handled by Stripe</li>
              <li>✓ Takes 5–10 minutes</li>
              <li>✓ Supports ACH and card payments</li>
            </ul>
            <button
              type="button"
              onClick={handleConnectBank}
              disabled={connectLoading}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {connectLoading ? "Redirecting…" : "Connect bank account"}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <>
            {landlord?.subscription_status && landlord.subscription_status !== "inactive" && landlord.subscription_status !== "canceled" ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-800">Your plan</h2>
                <p className="text-sm text-slate-700">
                  <span className="mr-2">✓</span>
                  <span className="font-medium">Pro Plan — Active</span>
                </p>
                {landlord.subscription_current_period_end && (
                  <p className="text-sm text-slate-600">
                    Next billing date:{" "}
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
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h2 className="text-base font-semibold text-slate-900">Upgrade to Bannerman Leasing Pro</h2>
                  {country === "US" ? (
                    <p className="mt-2 text-sm text-slate-700">
                      One AI-generated lease saves you $150–$500 in attorney fees. Pro costs $24.99/month.
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-slate-700">
                      One AI-generated lease saves you £150–£500 in solicitor fees. Pro costs £19.99/month.
                    </p>
                  )}
                  <ul className="mt-4 space-y-1 text-sm text-slate-800">
                    <li>✓ Unlimited properties</li>
                    <li>✓ AI Lease Generator (UK & US)</li>
                    <li>✓ AI Document Hub</li>
                    <li>✓ Eviction Notice Generator</li>
                    <li>✓ Tenant Screening &amp; Passport</li>
                    <li>✓ Priority support</li>
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {country === "US" ? (
                      <button
                        type="button"
                        onClick={() => handleSubscribe("usd")}
                        disabled={checkoutLoading === "usd"}
                        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {checkoutLoading === "usd" ? "Redirecting…" : "Upgrade — $24.99/month (US)"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSubscribe("gbp")}
                        disabled={checkoutLoading === "gbp"}
                        className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                      >
                        {checkoutLoading === "gbp" ? "Redirecting…" : "Upgrade — £19.99/month (UK)"}
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Cancel anytime. No long-term commitment. You’ll be billed monthly in {country === "US" ? "USD" : "GBP"} via Stripe.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h3 className="text-sm font-semibold text-slate-900">See how quickly Pro pays for itself</h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                    <span>How many leases do you generate per year?</span>
                    {[1, 2, 3, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setLeasesPerYear(n as 1 | 2 | 3 | 5)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border ${
                          leasesPerYear === n
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700"
                        }`}
                      >
                        {n === 5 ? "5+" : n}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-700">
                    You'd save approximately{" "}
                    <span className="font-semibold">
                      {currencySymbol}
                      {yearlySavings.toLocaleString()}
                    </span>{" "}
                    per year versus solicitor/attorney fees.
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Pro pays for itself in about{" "}
                    <span className="font-semibold">{paysForItselfMonths}</span> month
                    {paysForItselfMonths === 1 ? "" : "s"} at this usage.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
