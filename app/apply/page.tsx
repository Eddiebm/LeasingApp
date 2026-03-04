import ApplicationForm from "../../components/ApplicationForm";

export default function ApplyPage() {
  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Rental Application</h1>
      <p className="text-sm text-slate-600">
        Apply for a Bannerman Group property in a few quick steps.
      </p>
      <ApplicationForm />
    </main>
  );
}

