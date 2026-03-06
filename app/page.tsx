import Link from "next/link";

export default function HomePage() {
  return (
    <main className="space-y-10">
      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">
          Simple property management for independent landlords
        </h1>
        <p className="text-sm text-slate-600 max-w-xl">
          Generate leases, screen tenants, and manage applications — without the paperwork.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">For landlords</h2>
          <p className="text-sm text-slate-600">
            Set up a new rental or start the eviction process in a few clicks.
          </p>
          <div className="space-y-3 pt-2">
            <Link
              href="/generate-lease"
              className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-slate-800"
            >
              Create a Lease Agreement
            </Link>
            <Link
              href="/eviction"
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Start Eviction Process
            </Link>
            <Link
              href="/dashboard"
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50 min-h-[48px] flex items-center justify-center"
            >
              Landlord Dashboard
            </Link>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">For tenants</h2>
          <p className="text-sm text-slate-600">
            Apply for a rental, check your status, or report a maintenance issue.
          </p>
          <div className="space-y-3 pt-2">
            <Link
              href="/apply"
              className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply for a Rental
            </Link>
            <Link
              href="/report"
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Report a Maintenance Issue
            </Link>
            <Link
              href="/portal"
              className="block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-900 hover:bg-slate-50 min-h-[48px] flex items-center justify-center"
            >
              Tenant Portal
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-8 flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 text-xs text-slate-500">
        <Link href="/privacy" className="hover:text-slate-700 underline py-3 px-3">
          Privacy &amp; data
        </Link>
        <Link href="/terms" className="hover:text-slate-700 underline py-3 px-3">
          Terms of Service
        </Link>
        <Link href="/pay" className="hover:text-slate-700 underline py-3 px-3">
          Pay rent / fees
        </Link>
      </footer>
    </main>
  );
}

