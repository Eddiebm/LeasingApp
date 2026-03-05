import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of use for Bannerman Leasing."
};

export default function TermsPage() {
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Terms of Service</h1>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">1. Acceptance</h2>
        <p>
          By using this platform to submit rental applications, pay fees, sign leases, or use the landlord dashboard or tenant portal, you agree to these terms. If you are using the service on behalf of a company or landlord, you represent that you have authority to bind them.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">2. Use of the service</h2>
        <p>
          You will use the service only for lawful purposes. You will provide accurate information in applications and will not impersonate others. Landlords are responsible for their listings, compliance with fair housing and local laws, and for handling applicant data in accordance with privacy and consumer reporting rules (including the FCRA where applicable).
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">3. Payments and fees</h2>
        <p>
          Screening fees, rent, and other payments are processed by our payment provider. Refunds and disputes are subject to our and the provider’s policies. Subscription fees for landlords are billed in accordance with the plan selected at checkout.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">4. Changes and availability</h2>
        <p>
          We may change these terms or the service with notice where required. Continued use after changes constitutes acceptance. We do not guarantee uninterrupted availability.
        </p>
      </section>

      <section className="space-y-2 text-sm text-slate-700">
        <h2 className="font-semibold text-slate-900">5. Contact</h2>
        <p>
          For questions about these terms, contact the property manager or landlord whose link you used, or the platform operator at the contact details provided in the application or dashboard.
        </p>
      </section>

      <p className="text-center text-sm text-slate-500">
        <Link href="/" className="underline">Back to home</Link>
      </p>
    </main>
  );
}
