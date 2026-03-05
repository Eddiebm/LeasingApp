import Link from "next/link";

/**
 * Apply requires a landlord slug (e.g. /apply/your-landlord). This page directs applicants to use the link from their landlord.
 */
export default function ApplyPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Rental Application</h1>
      <p className="text-sm text-slate-600">
        Use the apply link from your landlord to submit an application. It will look like:
      </p>
      <p className="rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm text-slate-800">
        …/apply/<span className="text-slate-500">landlord-slug</span>
      </p>
      <p className="text-sm text-slate-600">
        If you don’t have a link, contact the landlord or property manager for the correct application URL.
      </p>
      <Link href="/" className="inline-block text-sm font-medium text-slate-700 underline hover:no-underline">
        Back to home
      </Link>
    </main>
  );
}

