"use client";

import Link from "next/link";

const primaryLinks = [
  { href: "/documents", label: "Get a lease or eviction notice", sub: "Just say what you need in plain English — no forms, no dropdowns" },
  { href: "/generate-lease", label: "Generate a Lease (step-by-step)" },
  { href: "/eviction", label: "Eviction notice (questionnaire)" },
  { href: "/apply", label: "Start Rental Application" },
  { href: "/dashboard", label: "Landlord Dashboard" },
];

export default function DesignDemosPage() {
  return (
    <main className="min-h-screen bg-slate-100 py-8">
      <div className="mx-auto max-w-4xl space-y-16 px-4">
        <header className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Design alternatives</h1>
          <p className="mt-1 text-slate-600">Same content, different look. Pick one to inspire your home page.</p>
          <Link href="/" className="mt-4 inline-block text-sm text-slate-500 underline">← Back to home</Link>
        </header>

        {/* ——— 1. Current (baseline) ——— */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">1. Current — Minimal slate</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-900">RentLease</h3>
              <p className="text-sm text-slate-600">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl bg-slate-900 px-4 py-4 text-center text-white shadow-md">
                <span className="block font-medium">Get a lease or eviction notice</span>
                <span className="mt-1 block text-sm text-slate-300">Just say what you need in plain English — no forms, no dropdowns</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-900">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 2. Warm — Stone + amber accent ——— */}
        <section className="rounded-2xl border border-amber-200/60 bg-amber-50/50 p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-amber-800/70">2. Warm — Stone + amber</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-stone-800">RentLease</h3>
              <p className="text-sm text-stone-600">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-amber-700 px-4 py-4 text-center text-amber-50 shadow-md">
                <span className="block font-medium">Get a lease or eviction notice</span>
                <span className="mt-1 block text-sm text-amber-100">Just say what you need in plain English — no forms, no dropdowns</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-2xl border border-stone-300 bg-white px-4 py-3 text-center font-medium text-stone-800 shadow-sm">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 3. Bold — Strong accent + high contrast ——— */}
        <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-md">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">3. Bold — Emerald accent</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-3xl font-bold tracking-tight text-slate-900">RentLease</h3>
              <p className="mt-1 text-sm font-medium text-slate-600">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl bg-emerald-600 px-4 py-4 text-center font-semibold text-white shadow-lg shadow-emerald-900/20">
                <span className="block">Get a lease or eviction notice</span>
                <span className="mt-1 block text-sm font-normal text-emerald-100">Just say what you need in plain English — no forms, no dropdowns</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-center font-semibold text-slate-900">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 4. Soft — Rounded, gradient, friendly ——— */}
        <section className="rounded-3xl bg-gradient-to-b from-indigo-50 to-white p-6 shadow-inner" style={{ border: "1px solid rgba(99, 102, 241, 0.15)" }}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-indigo-600/80">4. Soft — Rounded & friendly</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-slate-800">RentLease</h3>
              <p className="text-sm text-slate-600">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-2xl bg-indigo-500 px-4 py-4 text-center font-medium text-white shadow-md">
                <span className="block">Get a lease or eviction notice</span>
                <span className="mt-1 block text-sm text-indigo-100">Just say what you need in plain English — no forms, no dropdowns</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-2xl border border-indigo-200/60 bg-white/90 px-4 py-3 text-center font-medium text-slate-800 backdrop-blur">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 5. Pro — Navy + gold accent (established) ——— */}
        <section className="rounded-2xl border border-slate-300 bg-slate-800 p-6 text-white shadow-xl">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-amber-400/90">5. Pro — Navy & gold</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-white">RentLease</h3>
              <p className="text-sm text-slate-300">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-3">
              <div className="rounded-xl border-2 border-amber-400 bg-amber-500 px-4 py-4 text-center font-semibold text-slate-900">
                <span className="block">Get a lease or eviction notice</span>
                <span className="mt-1 block text-sm font-normal text-slate-800">Just say what you need in plain English — no forms, no dropdowns</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-xl border border-slate-500 bg-slate-700/50 px-4 py-3 text-center font-medium text-slate-100">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        {/* ——— 6. Editorial — Serif headline, lots of white space ——— */}
        <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">6. Editorial — Serif & space</h2>
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-6">
              <h3 className="font-serif text-3xl font-normal text-slate-900">RentLease</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Simple tenant applications, screenings, and leases for RentLease.</p>
            </div>
            <div className="grid gap-2">
              <div className="rounded-lg bg-slate-900 py-3.5 pl-5 pr-4 text-left font-medium text-white">
                <span className="block">Get a lease or eviction notice</span>
                <span className="mt-0.5 block text-sm font-normal text-slate-400">Just say what you need in plain English</span>
              </div>
              {primaryLinks.slice(1, 4).map((l) => (
                <div key={l.href} className="rounded-lg border border-slate-200 py-3 pl-5 text-left font-medium text-slate-700">{l.label}</div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-center text-sm text-slate-500">
          <Link href="/" className="underline">← Back to home</Link>
        </div>
      </div>
    </main>
  );
}
