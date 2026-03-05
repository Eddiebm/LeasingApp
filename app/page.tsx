import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Bannerman Leasing</h1>
        <p className="text-sm text-slate-600">
          Simple tenant applications, screenings, and leases for The Bannerman Group.
        </p>
      </header>

      <div className="grid gap-4">
        <Link
          href="/apply"
          className="rounded-xl bg-black px-4 py-3 text-center text-white text-base font-medium"
        >
          Start Rental Application
        </Link>

        <Link
          href="/report"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-slate-900 text-base font-medium"
        >
          Report a problem (tenants)
        </Link>

        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-slate-900 text-base font-medium"
        >
          Landlord Dashboard
        </Link>

        <Link
          href="/portal"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-slate-900 text-base font-medium"
        >
          Tenant Portal
        </Link>

        <Link
          href="/pay"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-slate-900 text-base font-medium"
        >
          Pay (rent, fees)
        </Link>

        <Link
          href="/privacy"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-slate-600 text-sm"
        >
          Privacy &amp; data
        </Link>

        <Link
          href="/terms"
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-slate-600 text-sm"
        >
          Terms of Service
        </Link>
      </div>
    </main>
  );
}

