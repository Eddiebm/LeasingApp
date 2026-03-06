import Image from "next/image";
import Link from "next/link";
import { getSupabaseServer } from "../../../lib/supabaseServer";
import { ListingShareRow } from "../../../components/ListingShareRow";

export const runtime = "edge";

async function fetchProperty(slug: string) {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, address, city, state, zip, rent, is_listed, listing_headline, listing_description, listing_photo_url, bedrooms, bathrooms, available_from, landlords!inner(slug)"
    )
    .eq("listing_slug", slug)
    .maybeSingle();
  if (error) {
    console.error("listing fetch error", error);
  }
  return data as
    | {
        id: string;
        address: string;
        city: string;
        state: string;
        zip: string;
        rent: number | null;
        is_listed: boolean | null;
        listing_headline: string | null;
        listing_description: string | null;
        listing_photo_url: string | null;
        bedrooms: number | null;
        bathrooms: number | null;
        available_from: string | null;
        landlords: { slug: string | null } | null;
      }
    | null;
}

type PageParams = { params: { slug: string } };

export async function generateMetadata({ params }: PageParams) {
  const property = await fetchProperty(params.slug);
  if (!property || property.is_listed === false) {
    return {
      title: "Listing not found — Bannerman Leasing",
      description: "This rental listing is no longer active.",
    };
  }

  const title = property.listing_headline || property.address || "Rental listing";
  const description = `${property.bedrooms ?? ""}bd/${property.bathrooms ?? ""}ba · $${property.rent ?? ""}/mo · ${property.address ?? ""}`;

  const BASE = "https://leasingapp.pages.dev";
  const socialCardUrl = `${BASE}/api/properties/${property.id}/social-card`;

  return {
    title: `${title} — Bannerman Leasing`,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: socialCardUrl, width: 1080, height: 1080, alt: title }],
      type: "website",
      siteName: "Bannerman Leasing",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialCardUrl],
    },
  };
}

export default async function ListingPage({ params }: PageParams) {
  const property = await fetchProperty(params.slug);

  if (!property) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Listing not found</h1>
        <p className="text-sm text-slate-600">This rental listing could not be found.</p>
      </main>
    );
  }

  if (property.is_listed === false) {
    return (
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">Listing inactive</h1>
        <p className="text-sm text-slate-600">This listing is no longer active.</p>
      </main>
    );
  }

  const price = property.rent != null ? `$${property.rent.toLocaleString()}/month` : "";
  const bedsBaths =
    property.bedrooms || property.bathrooms
      ? `${property.bedrooms ?? "—"} bed · ${property.bathrooms ?? "—"} bath`
      : "";
  const addressLine = [property.address, property.city, property.state, property.zip].filter(Boolean).join(", ");
  const available =
    property.available_from != null
      ? new Date(property.available_from).toLocaleDateString(undefined, {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;
  const landlordSlug = property.landlords?.slug ?? null;
  const applyHref =
    landlordSlug != null
      ? `/apply/${encodeURIComponent(landlordSlug)}?property=${encodeURIComponent(property.id)}`
      : "/apply";

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      {property.listing_photo_url && (
        <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-slate-200 sm:h-80">
          <Image
            src={property.listing_photo_url}
            alt={property.listing_headline || addressLine || "Property photo"}
            fill
            className="object-cover"
          />
        </div>
      )}

      <div className="space-y-3">
        {price && <p className="text-2xl font-bold text-slate-900">{price}</p>}
        {bedsBaths && <p className="text-sm text-slate-600">{bedsBaths}</p>}
        {addressLine && <p className="text-sm text-slate-700">{addressLine}</p>}
        {available && (
          <p className="text-sm text-slate-600">
            <span className="font-medium">Available from:</span> {available}
          </p>
        )}
      </div>

      {property.listing_description && (
        <p className="whitespace-pre-line text-sm text-slate-700">{property.listing_description}</p>
      )}

      <div className="space-y-4 pt-2">
        <Link
          href={applyHref}
          className="inline-flex items-center rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800"
        >
          Apply Now
        </Link>
        <ListingShareRow
          listingUrl={`https://leasingapp.pages.dev/listing/${params.slug}`}
          headline={property.listing_headline || addressLine || "Rental listing"}
          price={price}
          bedsBaths={bedsBaths}
          availableFrom={property.available_from}
          propertyId={property.id}
        />
      </div>
      {/* Fallback image hint for scrapers that don't read OG tags */}
      <link rel="image_src" href={`https://leasingapp.pages.dev/api/properties/${property.id}/social-card`} />
    </main>
  );
}

