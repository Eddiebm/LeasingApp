import Link from "next/link";

export const metadata = {
  title: "Privacy",
  description: "Privacy and data retention for RentLease."
};

export default function PrivacyPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Privacy &amp; data retention</h1>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">What we collect</h2>
        <p>
          When you apply to rent a property, we store the information you provide (name, contact details, employment, housing history, consents, and signature). We also store documents you upload, results of screening checks, and records of maintenance requests and payments. We keep this data for business and legal purposes.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">Your rights</h2>
        <p>
          You may request a copy of the data we hold about you or request deletion, subject to legal and contractual obligations. Contact us using the details provided by your property manager.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Link href="/request-data" className="font-medium text-slate-900 underline">Request my data</Link>
          <Link href="/delete-data" className="font-medium text-slate-900 underline">Request deletion of my data</Link>
        </div>
      </section>

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="underline">Back to home</Link>
      </p>
    </main>
  );
}
