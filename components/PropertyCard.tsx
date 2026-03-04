type Property = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number;
  status: string;
};

export default function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold">{property.address}</p>
      <p className="text-xs text-slate-500">
        {property.city}, {property.state} {property.zip}
      </p>
      <p className="mt-2 text-sm text-slate-700">Rent: ${property.rent}</p>
      <span className="mt-2 inline-block rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
        {property.status}
      </span>
    </div>
  );
}
