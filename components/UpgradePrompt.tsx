"use client";

import Link from "next/link";

function getSavingsCopy(feature: string): { title: string; body: string; payoff: string } {
  const name = feature;
  const lower = feature.toLowerCase();
  if (lower.includes("lease")) {
    return {
      title: `${name} — Pro Feature`,
      body: "This tool generates legally accurate UK and US tenancy agreements in minutes, saving £150–£500 per lease.",
      payoff: "One lease pays for around 7 months of Pro."
    };
  }
  if (lower.includes("screening") || lower.includes("passport")) {
    return {
      title: `${name} — Pro Feature`,
      body: "Tenant screening and the Tenant Passport save £20–£30 per reference while giving you instant, reusable reports.",
      payoff: "Screen 2–3 tenants and Pro has paid for itself."
    };
  }
  if (lower.includes("eviction")) {
    return {
      title: `${name} — Pro Feature`,
      body: "This assistant prepares the right eviction notice for your jurisdiction, saving £100–£300 in solicitor fees.",
      payoff: "One notice often covers several months of Pro."
    };
  }
  if (lower.includes("document")) {
    return {
      title: `${name} — Pro Feature`,
      body: "AI Document Hub replaces your letting agent’s document service with on-demand, reusable templates.",
      payoff: "Using it for a few tenancies a year pays for Pro many times over."
    };
  }
  return {
    title: `${name} — Pro Feature`,
    body: "Pro unlocks advanced AI tools and unlimited usage, replacing one-off legal and admin costs.",
    payoff: "In most cases, a single use pays for several months of Pro."
  };
}

export function UpgradePrompt({ feature, onClose }: { feature: string; onClose: () => void }) {
  const { title, body, payoff } = getSavingsCopy(feature);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-slate-900">🔒 {title}</h2>
        <p className="mt-3 text-sm text-slate-700">{body}</p>
        <p className="mt-2 text-sm font-medium text-slate-900">{payoff}</p>
        <p className="mt-1 text-xs text-slate-500">
          Upgrade to Pro — from £19.99/month (UK) or $24.99/month (US).
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/dashboard/billing"
            className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Upgrade to Pro
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}

