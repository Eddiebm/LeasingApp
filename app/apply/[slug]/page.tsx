export const runtime = "edge";

import ApplicationForm from "../../../components/ApplicationForm";

type ApplyForLandlordPageProps = {
  params: { slug: string };
  searchParams: { property?: string };
};

export default function ApplyForLandlordPage({ params, searchParams }: ApplyForLandlordPageProps) {
  const { slug } = params;
  const propertyId = searchParams?.property;
  const displayName = slug.replace(/-/g, " ");

  return (
    <main className="space-y-4">
      <h1 className="text-2xl font-bold">Rental Application</h1>
      <p className="text-sm text-slate-600">
        Apply for a property with {displayName}.
      </p>
      <ApplicationForm landlordSlug={slug} initialPropertyId={propertyId} />
    </main>
  );
}
