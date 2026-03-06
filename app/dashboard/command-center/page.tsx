"use client";
export const runtime = "edge";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

type CommandCenterData = {
  period: string;
  periodStart: string;
  periodEnd: string;
  revenue: {
    screeningCents: number;
    rentFeesCents: number;
    totalCents: number;
    estimatedAnnualCents: number;
  };
  landlords: {
    total: number;
    newInPeriod: number;
    withConnect: number;
    subscribed: number;
    withProperty: number;
    withListing: number;
  };
  tenants?: {
    total: number;
    newInPeriod: number;
    applicants: number;
    paidScreening: number;
  };
  properties: { total: number; listed: number };
  leases?: {
    total: number;
    expiringThisMonth: number;
    expiringNextMonth: number;
    expiringByMonth: Record<string, number>;
  };
  where?: {
    landlordsByCountry: Record<string, number>;
    propertiesByState: Record<string, number>;
  };
  applications: {
    total: number;
    newInPeriod: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  rentPayments: { succeeded: number; failed: number; pending: number };
  maintenance: { total: number; open: number };
  recentLandlords: {
    id: string;
    name: string | null;
    email: string;
    createdAt: string;
    propertyCount: number;
    applicationCount: number;
    connectOnboarded: boolean;
    subscriptionStatus: string;
  }[];
  failedRentPayments: { id: string; createdAt: string; amountCents: number; landlordId: string }[];
  aiUsage?: {
    period: { promptTokens: number; completionTokens: number; totalTokens: number; calls: number };
    ytd: { promptTokens: number; completionTokens: number; totalTokens: number; calls: number };
  };
  redFlags?: {
    failedRentPayments: number;
    rentPaymentsOverdue: number;
    screeningPaymentsStuck: number;
    listedPropertiesNoConnect: number;
  };
};

const PERIODS = ["day", "week", "month", "year"] as const;
const ADMIN_USER_ID = "4c447225-b57c-4da1-83ff-94cc25ad6755";
const ACCESS_REDIRECT_DELAY_MS = 2500;

function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CommandCenterPage() {
  const router = useRouter();
  const [session, setSession] = useState<{ access_token: string; user?: { id?: string } } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [accessChecked, setAccessChecked] = useState(false);
  const [period, setPeriod] = useState<typeof PERIODS[number]>("month");
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    const isKnownAdminUser = session?.user?.id === ADMIN_USER_ID;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    fetch("/api/dashboard/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((me) => {
        setRole(me.role ?? null);
        const explicitNonAdminRole = typeof me.role === "string" && me.role !== "admin";
        if (explicitNonAdminRole && !isKnownAdminUser) {
          redirectTimer = setTimeout(() => {
            router.replace("/dashboard");
          }, ACCESS_REDIRECT_DELAY_MS);
        }
      })
      .catch(() => setRole(null))
      .finally(() => setAccessChecked(true));

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [session?.access_token, session?.user?.id, router]);

  const isKnownAdminUser = session?.user?.id === ADMIN_USER_ID;

  const fetchData = useCallback(() => {
    if (!session?.access_token || (role !== "admin" && !isKnownAdminUser)) return;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/command-center?period=${period}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session?.access_token, role, period, isKnownAdminUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!accessChecked || (role !== "admin" && !isKnownAdminUser)) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-slate-600">Checking access…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Command Center</h1>
          <p className="text-sm text-slate-600">
            Platform overview: revenue, members, system health. Admin only.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as typeof PERIODS[number])}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-slate-600">Loading…</p>
      ) : data ? (
        <>
          {/* Revenue */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Revenue (this period)</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Screening fees</p>
                <p className="text-xl font-bold text-slate-900">{formatCents(data.revenue.screeningCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rent platform fees</p>
                <p className="text-xl font-bold text-slate-900">{formatCents(data.revenue.rentFeesCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total</p>
                <p className="text-xl font-bold text-emerald-700">{formatCents(data.revenue.totalCents)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Est. annual (YTD)</p>
                <p className="text-xl font-bold text-slate-900">{formatCents(data.revenue.estimatedAnnualCents)}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              For tax year {new Date().getFullYear()}, use estimated annual as a baseline. Stripe Dashboard has exact payouts and fees.
            </p>
          </section>

          {/* Members: people on the platform */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Members & usage</h2>
            <p className="mt-1 text-xs text-slate-500">Registered users and how many use key services (any time).</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Landlords (registered)</p>
                <p className="text-2xl font-bold text-slate-900">{data.landlords.total}</p>
                <p className="mt-1 text-xs text-slate-600">+{data.landlords.newInPeriod} this period</p>
                <p className="mt-2 text-xs text-slate-600">
                  Using services: {data.landlords.withProperty} with properties · {data.landlords.withListing} with listing · {data.landlords.withConnect} Connect · {data.landlords.subscribed} Pro
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Renters (tenants)</p>
                <p className="text-2xl font-bold text-slate-900">{data.tenants?.total ?? 0}</p>
                <p className="mt-1 text-xs text-slate-600">+{data.tenants?.newInPeriod ?? 0} this period</p>
                <p className="mt-2 text-xs text-slate-600">
                  Using services: {data.tenants?.applicants ?? 0} applied · {data.tenants?.paidScreening ?? 0} paid screening
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Properties</p>
                <p className="text-2xl font-bold text-slate-900">{data.properties.total}</p>
                <p className="mt-1 text-xs text-slate-600">{data.properties.listed} listed</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Rent payments</p>
                <p className="text-2xl font-bold text-slate-900">{data.rentPayments.succeeded}</p>
                <p className="mt-1 text-xs text-slate-600">
                  {data.rentPayments.pending} pending · <span className="text-red-600">{data.rentPayments.failed} failed</span>
                </p>
              </div>
            </div>
          </section>

          {/* Where: geography */}
          {data.where && (Object.keys(data.where.landlordsByCountry).length > 0 || Object.keys(data.where.propertiesByState).length > 0) && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Where</h2>
              <p className="mt-1 text-xs text-slate-500">Landlords by country; properties by state.</p>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Landlords by country</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {Object.entries(data.where.landlordsByCountry)
                      .sort((a, b) => b[1] - a[1])
                      .map(([country, count]) => (
                        <li key={country} className="flex justify-between">
                          <span>{country === "unknown" ? "(not set)" : country}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Properties by state</p>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm">
                    {Object.entries(data.where.propertiesByState)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 30)
                      .map(([state, count]) => (
                        <li key={state} className="flex justify-between">
                          <span>{state === "unknown" ? "(not set)" : state}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Leases */}
          {data.leases && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">Leases</h2>
              <p className="mt-1 text-xs text-slate-500">Signed leases (applications with lease signed). Expiring counts use lease end date (set lease_end_at on applications; run migration 015).</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total signed</p>
                  <p className="text-2xl font-bold text-slate-900">{data.leases.total}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expiring this month</p>
                  <p className="text-2xl font-bold text-amber-700">{data.leases.expiringThisMonth}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expiring next month</p>
                  <p className="text-2xl font-bold text-slate-700">{data.leases.expiringNextMonth}</p>
                </div>
              </div>
              {Object.keys(data.leases.expiringByMonth).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Expiring by month (next 12)</p>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3 md:grid-cols-4">
                    {Object.entries(data.leases.expiringByMonth)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([month, count]) => (
                        <div key={month} className="flex justify-between">
                          <span className="text-slate-600">{month}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* KPIs row */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Applications</p>
              <p className="text-2xl font-bold text-slate-900">{data.applications.total}</p>
              <p className="mt-1 text-xs text-slate-600">
                +{data.applications.newInPeriod} this period · {data.applications.approved} approved · {data.applications.rejected} rejected · {data.applications.pending} pending
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Maintenance</p>
              <p className="text-2xl font-bold text-slate-900">{data.maintenance.open}</p>
              <p className="mt-1 text-xs text-slate-600">{data.maintenance.total} total requests</p>
            </div>
          </section>

          {/* AI usage */}
          {data.aiUsage && (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-800">AI token usage</h2>
              <p className="mt-1 text-xs text-slate-500">OpenAI (e.g. lease/eviction/doc generation). Run migration 014 to enable logging.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">This period</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{data.aiUsage.period.totalTokens.toLocaleString()} tokens</p>
                  <p className="text-sm text-slate-600">
                    {data.aiUsage.period.promptTokens.toLocaleString()} in / {data.aiUsage.period.completionTokens.toLocaleString()} out · {data.aiUsage.period.calls} calls
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Year to date</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{data.aiUsage.ytd.totalTokens.toLocaleString()} tokens</p>
                  <p className="text-sm text-slate-600">
                    {data.aiUsage.ytd.promptTokens.toLocaleString()} in / {data.aiUsage.ytd.completionTokens.toLocaleString()} out · {data.aiUsage.ytd.calls} calls
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Red flags */}
          {data.redFlags && (
            <section className="rounded-2xl border border-red-200 bg-red-50/50 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-red-900">Red flags</h2>
              <p className="mt-1 text-sm text-red-800">Issues that may need attention.</p>
              <ul className="mt-4 space-y-2 text-sm">
                {data.redFlags.failedRentPayments > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-red-700">Failed rent payments:</span>
                    <span>{data.redFlags.failedRentPayments}</span>
                  </li>
                )}
                {data.redFlags.rentPaymentsOverdue > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-red-700">Rent payments overdue (pending, past due date):</span>
                    <span>{data.redFlags.rentPaymentsOverdue}</span>
                  </li>
                )}
                {data.redFlags.screeningPaymentsStuck > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-red-700">Screening payments stuck (not paid, &gt;24h old):</span>
                    <span>{data.redFlags.screeningPaymentsStuck}</span>
                  </li>
                )}
                {data.redFlags.listedPropertiesNoConnect > 0 && (
                  <li className="flex items-center gap-2">
                    <span className="font-medium text-red-700">Listed properties with landlord not Connect-onboarded:</span>
                    <span>{data.redFlags.listedPropertiesNoConnect}</span>
                  </li>
                )}
                {data.redFlags.failedRentPayments === 0 &&
                  data.redFlags.rentPaymentsOverdue === 0 &&
                  data.redFlags.screeningPaymentsStuck === 0 &&
                  data.redFlags.listedPropertiesNoConnect === 0 && (
                    <li className="text-red-700">No red flags right now.</li>
                  )}
              </ul>
            </section>
          )}

          {/* Maintenance */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800">Maintenance requests</h2>
            <p className="mt-1 text-slate-700">
              {data.maintenance.open} open of {data.maintenance.total} total
            </p>
          </section>

          {/* Recent landlords */}
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Recent landlords</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-600">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Properties</th>
                    <th className="pb-2 pr-4">Applications</th>
                    <th className="pb-2 pr-4">Connect</th>
                    <th className="pb-2 pr-4">Subscription</th>
                    <th className="pb-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLandlords.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100">
                      <td className="py-2 pr-4 font-medium">{l.name || "—"}</td>
                      <td className="py-2 pr-4">{l.email}</td>
                      <td className="py-2 pr-4">{l.propertyCount}</td>
                      <td className="py-2 pr-4">{l.applicationCount}</td>
                      <td className="py-2 pr-4">{l.connectOnboarded ? "✓" : "—"}</td>
                      <td className="py-2 pr-4">{l.subscriptionStatus === "active" ? "Pro" : "Free"}</td>
                      <td className="py-2 text-slate-500">{formatDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Problems: failed rent payments */}
          <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900">Problems & health</h2>
            {data.failedRentPayments.length > 0 ? (
              <div className="mt-4">
                <p className="text-sm font-medium text-amber-800">Recent failed rent payments</p>
                <ul className="mt-2 space-y-1 text-sm text-amber-900">
                  {data.failedRentPayments.slice(0, 10).map((f) => (
                    <li key={f.id}>
                      {formatCents(f.amountCents)} — {formatDate(f.createdAt)} (landlord: {f.landlordId.slice(0, 8)}…)
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-2 text-sm text-amber-800">No failed rent payments in recent record.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-900 hover:bg-amber-50"
              >
                Stripe Dashboard →
              </a>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium text-amber-900 hover:bg-amber-50"
              >
                Supabase →
              </a>
            </div>
            <p className="mt-3 text-xs text-amber-800">
              Revenue above is from this app’s database. For exact payouts, fees, and tax documents, use Stripe. For DB health and logs, use Supabase.
            </p>
          </section>
        </>
      ) : null}
    </main>
  );
}
