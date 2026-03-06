import Link from "next/link";

export const metadata = {
  title: "Free Leases for Landlords | Generate Leases Online | Bannerman Leasing",
  description: "Free lease agreements for landlords. Generate leases online, send for e-signature, and store in one place. No cost to get started."
};

export default function GenerateLeasesPage() {
  return (
    <main className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium text-emerald-600">Free for landlords</p>
        <h1 className="text-3xl font-bold text-slate-900">
          Free leases — generate yours online
        </h1>
        <p className="text-lg text-slate-600">
          Get free lease agreements. We generate the lease, you send it to tenants for e-signature, and everything is stored in one place. No cost to get started.
        </p>
      </header>

      <ul className="space-y-2 text-slate-700">
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span><strong>Free lease generation</strong> — one apply link, you approve, we create the lease PDF.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span>Tenants sign electronically and get a copy; you get a signed PDF in your dashboard.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-emerald-600 font-medium">✓</span>
          <span>Applications, leases, and rent in one platform — no more scattered paperwork.</span>
        </li>
      </ul>

      <div className="space-y-3 pt-2">
        <Link
          href="/dashboard/signup"
          className="block w-full rounded-xl bg-black px-4 py-4 text-center text-white text-base font-medium"
        >
          Get my free lease
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
