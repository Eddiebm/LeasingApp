import Image from "next/image";
import Link from "next/link";
import { getSupabaseServer } from "../../../lib/supabaseServer";
import ShareListingButton from "../../../components/ShareListingButton";
import type { Metadata } from "next";

export const runtime = "edge";

type RentalRow = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  photos: string[] | null;
  description: string | null;
  available_from: string | null;
  pets_allowed: string | null;
  furnished: boolean | null;
  parking: boolean | null;
  amenities: string[] | null;
  landlords: { full_name: string; company_name: string | null; slug: string | null } | null;
};

async function fetchRental(id: string): Promise<RentalRow | null> {
  const db = getSupabaseServer();
  const { data, error } = await db
    .from("properties")
    .select(
      "id, address, city, state, zip, rent, bedrooms, bathrooms, photos, description, available_from, pets_allowed, furnished, parking, amenities, landlords!inner(full_name, company_name, slug)"
    )
    .eq("id", id)
    .eq("is_listed", true)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return data as RentalRow;
}

type Props = { params: { id: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const property = await fetchRental(params.id);
  if (!property) {
    return { title: "Listing not found — Bannerman Leasing", description: "This rental listing is no longer active." };
  }
  const addressLine = [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ");
  const title = addressLine || "Rental listing";
  const description =
    (property.description?.slice(0, 160) ?? "") ||
    `${property.bedrooms ?? ""} bed · ${property.bathrooms ?? ""} bath · $${property.rent ?? ""}/mo`;
  const ogImage =
    Array.isArray(property.photos) && property.photos[0]
      ? property.photos[0]
      : `https://leasingapp.pages.dev/api/properties/${property.id}/social-card`;
  return {
    title: `${title} — Bannerman Leasing`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      type: "website",
      siteName: "Bannerman Leasing",
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function RentalDetailPage({ params }: Props) {
  const property = await fetchRental(params.id);

  if (!property) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-2xl font-bold text-slate-900">Listing not found</h1>
        <p className="mt-2 text-slate-600">This rental listing could not be found or is no longer available.</p>
        <Link href="/rentals" className="mt-4 inline-block text-slate-700 underline">Browse rentals</Link>
      </main>
    );
  }

  const addressLine = [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ");
  const landlordName = property.landlords?.company_name || property.landlords?.full_name || "Landlord";
  const landlordSlug = property.landlords?.slug ?? null;
  const applyHref =
    landlordSlug != null
      ? `/apply/${encodeURIComponent(landlordSlug)}?property=${encodeURIComponent(property.id)}`
      : "/apply";
  const photos = Array.isArray(property.photos) && property.photos.length > 0 ? property.photos : [];
  const coverUrl = photos[0] ?? null;
  const availableStr =
    property.available_from != null
      ? new Date(property.available_from).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const petsLabel =
    property.pets_allowed === "yes"
      ? "Pets allowed"
      : property.pets_allowed === "no"
        ? "No pets"
        : property.pets_allowed === "negotiable"
          ? "Pets negotiable"
          : null;
  const amenities = Array.isArray(property.amenities) ? property.amenities : [];

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Hero image */}
        {coverUrl && (
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-slate-200">
            <Image src={coverUrl} alt={addressLine || "Property"} fill className="object-cover" priority />
          </div>
        )}

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {photos.map((url, i) => (
              <div
                key={url}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg border-2 border-slate-200 bg-slate-100"
              >
                <Image src={url} alt="" fill className="object-cover" sizes="112px" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {property.rent != null && (
            <p className="text-2xl font-bold text-slate-900">${property.rent.toLocaleString()}/month</p>
          )}
          {addressLine && <p className="text-lg text-slate-700">{addressLine}</p>}
          <div className="flex flex-wrap gap-4 text-sm text-slate-600">
            {property.bedrooms != null && <span>{property.bedrooms} bed</span>}
            {property.bathrooms != null && <span>{property.bathrooms} bath</span>}
            {availableStr && <span>Available {availableStr}</span>}
          </div>

          {property.description && (
            <div className="border-t border-slate-200 pt-4">
              <h2 className="text-sm font-semibold text-slate-800">Description</h2>
              <p className="mt-1 whitespace-pre-line text-slate-700">{property.description}</p>
            </div>
          )}

          {(amenities.length > 0 || property.furnished || property.parking || petsLabel) && (
            <div className="border-t border-slate-200 pt-4">
              <h2 className="text-sm font-semibold text-slate-800">Details</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {property.furnished && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Furnished</span>
                )}
                {property.parking && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">Parking</span>
                )}
                {petsLabel && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{petsLabel}</span>
                )}
                {amenities.map((a) => (
                  <span key={a} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">Landlord:</span> {landlordName}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Link
              href={applyHref}
              className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
            >
              Apply now
            </Link>
            <ShareListingButton
              url={`/rentals/${property.id}`}
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function ShareButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const url = typeof window !== "undefined" ? window.location.href : "";
        navigator.clipboard?.writeText(url).then(() => alert("Link copied to clipboard."));
      }}
      className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      Share this listing
    </button>
  );
}
