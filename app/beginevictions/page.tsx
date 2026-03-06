import Link from "next/link";

export const metadata = {
  title: "Free Eviction Notices | Begin the Eviction Process | Bannerman Leasing",
  description: "Free eviction notices for landlords. Pay-or-quit, lease violation, and other notices that start the eviction process. Document everything in one place."
};

export default function BeginEvictionsPage() {
  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-emerald-600">Free for landlords</p>
        <h1 className="text-3xl font-bold text-slate-900">
          Free eviction notices — begin the process
        </h1>
        <p className="text-lg text-slate-600">
          Start the eviction process with free notices: pay-or-quit, lease violation, entry notice, and more. Generate and store them in one place so you have a clear paper trail. No cost to get started.
        </p>
      </header>

      <ul className="space-y-2 text-slate-700">
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span><strong>Free eviction notices</strong> — pay-or-quit, notice of violation, entry notice, and others that begin the eviction process.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span>All your tenant records in one dashboard: applications, signed leases, payments — the documentation you need.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span>No cost to get started. Sign up, generate your first notice, and keep everything organized.</span>
        </li>
      </ul>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
        <p className="font-medium">Legal disclaimer</p>
        <p className="mt-1 text-amber-800">
          These notices help you begin the eviction process. Eviction laws vary by state and locality. We provide the forms; consult an attorney for legal advice and court filings.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <Link
          href="/dashboard/signup"
          className="block w-full rounded-xl bg-black px-4 py-4 text-center text-white text-base font-medium"
        >
          Get my free eviction notices
        </Link>
        <p className="text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link href="/dashboard" className="underline text-slate-700">Landlord dashboard</Link>
        </p>
      </div>

      <footer className="pt-4 border-t border-slate-200">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Bannerman Leasing home
        </Link>
      </footer>
    </main>
  );
}
