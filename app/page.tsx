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
          href="/dashboard"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-slate-900 text-base font-medium"
        >
          Landlord Dashboard
        </Link>
      </div>
    </main>
  );
}

