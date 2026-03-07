"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TenantCard from "../../components/TenantCard";
import MaintenanceCard from "../../components/MaintenanceCard";
import { useSubscription } from "../../components/SubscriptionContext";
import { FREE_PROPERTY_LIMIT } from "../../lib/subscription";
import { supabase } from "../../lib/supabaseClient";

type Property = { id: string; address: string; city: string; state: string; zip: string; rent?: number; is_listed?: boolean; listing_slug?: string | null; photos?: string[] | null };
type Application = {
  id: string;
  tenantName: string;
  tenantEmail?: string;
  propertyId: string | null;
  propertyAddress: string;
  status: string;
  creditScore?: number | null;
  income?: number | null;
  rent?: number | null;
  screeningStatus?: "not_paid" | "paid_pending" | "complete";
  leaseStartAt?: string | null;
  leaseEndAt?: string | null;
};
type MaintenanceRequest = {
  id: string;
  category: string;
  description: string;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenantName: string;
  tenantEmail: string;
  propertyId: string | null;
  propertyAddress: string;
};

type LandlordProfile = { company_name: string | null; slug: string | null };

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const CSV_TEMPLATE_HEADERS = ["address", "city", "state", "zip", "rent", "status", "application_deadline"] as const;
const CSV_TEMPLATE_SAMPLE = "123 Main St,Springfield,IL,62701,1200,active,";

function downloadCsvTemplate() {
  const header = CSV_TEMPLATE_HEADERS.join(",");
  const csv = [header, CSV_TEMPLATE_SAMPLE].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "properties-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

type ParsedCsvRow = {
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: string;
  status: string;
  application_deadline: string;
};

function parseCsvFile(text: string): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const getIdx = (name: string) => header.indexOf(name);
  const addrIdx = getIdx("address");
  const cityIdx = getIdx("city");
  const stateIdx = getIdx("state");
  const zipIdx = getIdx("zip");
  const rentIdx = getIdx("rent");
  const statusIdx = getIdx("status");
  const appDeadlineIdx = getIdx("application_deadline");
  const useOrder =
    addrIdx === -1 && cityIdx === -1 && stateIdx === -1 && zipIdx === -1 && rentIdx === -1;
  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    const get = (idx: number) => (idx >= 0 && idx < cells.length ? cells[idx] ?? "" : "");
    if (useOrder && cells.length >= 5) {
      rows.push({
        address: (cells[0] ?? "").trim(),
        city: (cells[1] ?? "").trim(),
        state: (cells[2] ?? "").trim(),
        zip: (cells[3] ?? "").trim(),
        rent: (cells[4] ?? "").trim(),
        status: (cells[5] ?? "").trim(),
        application_deadline: (cells[6] ?? "").trim(),
      });
    } else if (addrIdx >= 0 && cityIdx >= 0 && stateIdx >= 0 && zipIdx >= 0 && rentIdx >= 0) {
      rows.push({
        address: get(addrIdx).trim(),
        city: get(cityIdx).trim(),
        state: get(stateIdx).trim(),
        zip: get(zipIdx).trim(),
        rent: get(rentIdx).trim(),
        status: statusIdx >= 0 ? get(statusIdx).trim() : "",
        application_deadline: appDeadlineIdx >= 0 ? get(appDeadlineIdx).trim() : "",
      });
    }
  }
  return rows;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validateCsvRow(row: ParsedCsvRow, index: number): string | null {
  if (!row.address.trim()) return `Row ${index + 1}: address is required.`;
  if (!row.city.trim()) return `Row ${index + 1}: city is required.`;
  if (!row.state.trim()) return `Row ${index + 1}: state is required.`;
  if (!row.zip.trim()) return `Row ${index + 1}: zip is required.`;
  const rent = parseFloat(String(row.rent).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(rent) || rent < 0) return `Row ${index + 1}: rent must be a valid number.`;
  const status = (row.status || "active").trim().toLowerCase();
  if (status && status !== "active" && status !== "inactive") {
    return `Row ${index + 1}: status must be "active" or "inactive".`;
  }
  if (row.application_deadline.trim() && !ISO_DATE.test(row.application_deadline.trim())) {
    return `Row ${index + 1}: application_deadline must be YYYY-MM-DD.`;
  }
  return null;
}

export default function Dashboard() {
  const router = useRouter();
  const { isPro } = useSubscription();
  const [session, setSession] = useState<{ access_token: string; user?: { email?: string } } | null>(null);
  const [landlord, setLandlord] = useState<LandlordProfile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [creatingProperty, setCreatingProperty] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [copiedApplyLinkPropertyId, setCopiedApplyLinkPropertyId] = useState<string | null>(null);
  const [applyLink, setApplyLink] = useState("");
  const [propertyForm, setPropertyForm] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
    rent: "",
    description: "",
    available_from: "",
    pets_allowed: "" as "" | "yes" | "no" | "negotiable",
    furnished: false,
    parking: false,
    amenities: [] as string[],
  });
  const AMENITY_OPTIONS = ["WiFi", "Washer/Dryer", "Dishwasher", "Air Conditioning", "Gym", "Pool", "Garden/Yard", "Storage"];
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [photoUploadingPropertyId, setPhotoUploadingPropertyId] = useState<string | null>(null);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvRowErrors, setCsvRowErrors] = useState<(string | null)[]>([]);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Property import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importQuery, setImportQuery] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    region?: string;
    formattedAddress?: string;
    address?: string | null;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    postcode?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
    squareFootage?: number | null;
    yearBuilt?: number | null;
    propertyType?: string | null;
    rentEstimate?: number | null;
    rentRangeLow?: number | null;
    rentRangeHigh?: number | null;
    requiresManualAddress?: boolean;
    serviceUnavailable?: boolean;
  } | null>(null);
  const [importForm, setImportForm] = useState({ address: "", city: "", state: "", zip: "", rent: "" });
  const [importSaving, setImportSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setSessionReady(true);
      if (!s) router.replace("/dashboard/login");
    });
  }, [router]);

  useEffect(() => {
    if (!session?.access_token) return;
    fetch("/api/dashboard/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data.role === "admin");
        if (data.landlord) {
          setLandlord({ company_name: data.landlord.company_name ?? null, slug: data.landlord.slug ?? null });
          if (data.landlord.slug && typeof window !== "undefined") {
            setApplyLink(`${window.location.origin}/apply/${data.landlord.slug}`);
          }
        }
      })
      .catch(() => {});
  }, [session?.access_token]);

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (!session?.access_token) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  }, [session?.access_token]);

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/properties?for=dashboard", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setProperties(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    }
  }, [getAuthHeaders]);

  const fetchApplications = useCallback(async () => {
    try {
      const url = propertyId ? `/api/applications?propertyId=${encodeURIComponent(propertyId)}` : "/api/applications";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data) ? data : []);
      } else {
        console.warn("Applications fetch failed:", res.status);
        setApplications([]);
      }
    } catch (e) {
      console.error(e);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, propertyId]);

  const fetchMaintenance = useCallback(async () => {
    try {
      const url = propertyId ? `/api/maintenance?propertyId=${encodeURIComponent(propertyId)}` : "/api/maintenance";
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMaintenance(Array.isArray(data) ? data : []);
      } else {
        console.warn("Maintenance fetch failed:", res.status);
        setMaintenance([]);
      }
    } catch (e) {
      console.error(e);
      setMaintenance([]);
    } finally {
      setMaintenanceLoading(false);
    }
  }, [getAuthHeaders, propertyId]);

  // Step 2: Only fetch data after session is confirmed
  useEffect(() => {
    if (!sessionReady) return;
    fetchProperties();
  }, [sessionReady, fetchProperties]);

  useEffect(() => {
    if (!sessionReady) return;
    setLoading(true);
    setMaintenanceLoading(true);
    fetchApplications();
    fetchMaintenance();
  }, [sessionReady, propertyId, fetchApplications, fetchMaintenance]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace("/dashboard/login");
  };

  if (!sessionReady) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading dashboard…</p>
      </div>
    );
  }

  const copyApplyLink = () => {
    if (!applyLink) return;
    navigator.clipboard.writeText(applyLink).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleImportLookup = async () => {
    const q = importQuery.trim();
    if (!q) return;
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch(`/api/properties/import-lookup?q=${encodeURIComponent(q)}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.error ?? "Could not look up property.");
        if (data.serviceUnavailable) {
          // Pre-fill the form with what the user typed so they can continue manually
          setImportForm({ address: q, city: "", state: "", zip: "", rent: "" });
        }
        return;
      }
      setImportResult(data);
      setImportForm({
        address: data.address ?? q,
        city: data.city ?? "",
        state: data.state ?? "",
        zip: data.zip ?? data.postcode ?? "",
        rent: data.rentEstimate ? String(Math.round(data.rentEstimate)) : "",
      });
    } catch {
      setImportError("Failed to look up property. Please try again.");
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportSave = async () => {
    if (!importForm.address || !importForm.city || !importForm.state || !importForm.zip || !importForm.rent) {
      setImportError("Please fill in all required fields.");
      return;
    }
    setImportSaving(true);
    setImportError(null);
    try {
      const res = await fetch("/api/properties/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          address: importForm.address,
          city: importForm.city,
          state: importForm.state,
          zip: importForm.zip,
          rent: importForm.rent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error ?? "Could not save property.");
        return;
      }
      // Success — close modal and refresh
      setImportModalOpen(false);
      setImportQuery("");
      setImportResult(null);
      setImportForm({ address: "", city: "", state: "", zip: "", rent: "" });
      setImportError(null);
      await fetchProperties();
    } catch {
      setImportError("There was a problem saving the property.");
    } finally {
      setImportSaving(false);
    }
  };

  const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
  const PHOTO_MAX = 10;
  const PHOTO_MAX_SIZE = 5 * 1024 * 1024;

  const addPendingPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!ALLOWED_PHOTO_TYPES.includes(f.type) || f.size > PHOTO_MAX_SIZE) continue;
      next.push(f);
    }
    setPendingPhotos((prev) => {
      const combined = [...prev, ...next].slice(0, PHOTO_MAX);
      return combined;
    });
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadPhotosToProperty = async (propertyId: string, files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      setUploadProgress(((i + 1) / files.length) * 100);
      const fd = new FormData();
      fd.set("property_id", propertyId);
      fd.set("photo", files[i]);
      const res = await fetch("/api/properties/upload-photo", {
        method: "POST",
        headers: getAuthHeaders() as Record<string, string>,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.photo_url) urls.push(data.photo_url);
    }
    setUploadProgress(null);
    return urls;
  };

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyForm.address || !propertyForm.city || !propertyForm.state || !propertyForm.zip || !propertyForm.rent) {
      alert("Please fill in all property fields.");
      return;
    }
    setCreatingProperty(true);
    setUploadProgress(0);
    try {
      const res = await fetch("/api/properties/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          address: propertyForm.address,
          city: propertyForm.city,
          state: propertyForm.state,
          zip: propertyForm.zip,
          rent: propertyForm.rent,
          description: propertyForm.description.slice(0, 1000) || undefined,
          available_from: propertyForm.available_from || undefined,
          pets_allowed: propertyForm.pets_allowed || undefined,
          furnished: propertyForm.furnished,
          parking: propertyForm.parking,
          amenities: propertyForm.amenities.length ? propertyForm.amenities : undefined,
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Could not create property.");
        return;
      }
      const newId = data.id as string | undefined;
      if (newId && pendingPhotos.length > 0) {
        setPhotoUploadingPropertyId(newId);
        await uploadPhotosToProperty(newId, pendingPhotos);
        setPendingPhotos([]);
        setPhotoUploadingPropertyId(null);
        await fetchProperties();
      }
      setPropertyForm({
        address: "",
        city: "",
        state: "",
        zip: "",
        rent: "",
        description: "",
        available_from: "",
        pets_allowed: "",
        furnished: false,
        parking: false,
        amenities: [],
      });
      await fetchProperties();
    } catch (err) {
      console.error(err);
      alert("There was a problem creating the property.");
    } finally {
      setCreatingProperty(false);
      setUploadProgress(null);
      setPhotoUploadingPropertyId(null);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setCsvUploadError(null);
    if (!file) {
      setCsvRows([]);
      setCsvRowErrors([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const rows = parseCsvFile(text);
      setCsvRows(rows);
      const errs = rows.map((r, i) => validateCsvRow(r, i));
      setCsvRowErrors(errs);
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleCsvUploadAll = async () => {
    const validRows = csvRows.filter((_, i) => !csvRowErrors[i]);
    if (validRows.length === 0) {
      setCsvUploadError("No valid rows to upload. Fix errors in the table and try again.");
      return;
    }
    setCsvUploadError(null);
    setCsvUploading(true);
    try {
      const properties = validRows.map((r) => {
        const statusRaw = (r.status || "active").trim().toLowerCase();
        const status = statusRaw === "inactive" ? "inactive" : "active";
        const appDeadline = r.application_deadline.trim();
        return {
          address: r.address.trim(),
          city: r.city.trim(),
          state: r.state.trim(),
          zip: r.zip.trim(),
          rent: parseFloat(String(r.rent).replace(/[^0-9.]/g, "")),
          status,
          application_deadline: appDeadline && ISO_DATE.test(appDeadline) ? appDeadline : undefined,
        };
      });
      const res = await fetch("/api/properties/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ properties }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(data.errors) ? data.errors.join(" ") : data.error || "Upload failed.";
        setCsvUploadError(msg);
        return;
      }
      setCsvModalOpen(false);
      setCsvRows([]);
      setCsvRowErrors([]);
      await fetchProperties();
    } catch (err) {
      console.error(err);
      setCsvUploadError("Network error. Please try again.");
    } finally {
      setCsvUploading(false);
    }
  };

  const csvValidCount = csvRows.length - csvRowErrors.filter(Boolean).length;

  const dashboardTitle = landlord?.company_name ? `${landlord.company_name} – Leasing` : "Leasing Dashboard";

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
          <p className="text-sm text-slate-600">
            Review applications, generate leases, and manage maintenance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Link
              href="/dashboard/command-center"
              className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              Command Center
            </Link>
          )}
          <Link
            href="/dashboard/settings"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Settings
          </Link>
          <Link
            href="/dashboard/billing"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Billing
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </div>

      {landlord?.slug && (
        <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Your apply link</h2>
          <p className="mb-3 text-xs text-slate-600">
            Share this link so applicants can apply to your properties. They’ll only see your listings.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="flex-1 min-w-0 rounded-lg bg-white px-3 py-2 text-sm text-slate-800 break-all border border-slate-200">
              {applyLink || `/apply/${landlord.slug}`}
            </code>
            <button
              type="button"
              onClick={copyApplyLink}
              className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {copyFeedback ? "Copied!" : "Copy link"}
            </button>
          </div>
        </section>
      )}

      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Add a property</h2>
        {!isPro && properties.length >= FREE_PROPERTY_LIMIT ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Free plan limit reached</p>
            <p className="mt-1 text-sm text-amber-800">
              You can have up to {FREE_PROPERTY_LIMIT} properties on the free plan. Upgrade to Pro for unlimited properties.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-3 inline-block rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Upgrade to Pro
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvModalOpen(true);
                  setCsvUploadError(null);
                  setCsvRows([]);
                  setCsvRowErrors([]);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Upload Properties (CSV)
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(true);
                  setImportQuery("");
                  setImportResult(null);
                  setImportError(null);
                  setImportForm({ address: "", city: "", state: "", zip: "", rent: "" });
                }}
                className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
              >
                &#x2B07; Import from Listing
              </button>
            </div>
            <form onSubmit={handleCreateProperty} className="mt-2 space-y-3">
              <div className="grid gap-2 md:grid-cols-5">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Address"
                  value={propertyForm.address}
                  onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="City"
                  value={propertyForm.city}
                  onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="State"
                  value={propertyForm.state}
                  onChange={(e) => setPropertyForm({ ...propertyForm, state: e.target.value })}
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="ZIP"
                  value={propertyForm.zip}
                  onChange={(e) => setPropertyForm({ ...propertyForm, zip: e.target.value })}
                />
                <div className="flex items-center gap-2">
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Rent (per month)"
                    value={propertyForm.rent}
                    onChange={(e) => setPropertyForm({ ...propertyForm, rent: e.target.value })}
                  />
                  <button
                    type="submit"
                    disabled={creatingProperty}
                    className="whitespace-nowrap rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {creatingProperty ? "Saving…" : "Add"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <textarea
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Describe your property… (optional, max 1000 chars)"
                  maxLength={1000}
                  rows={3}
                  value={propertyForm.description}
                  onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <span>Available from</span>
                    <input
                      type="date"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      value={propertyForm.available_from}
                      onChange={(e) => setPropertyForm({ ...propertyForm, available_from: e.target.value })}
                    />
                  </label>
                  <fieldset className="flex items-center gap-2 text-sm text-slate-700">
                    <span>Pets</span>
                    {(["yes", "no", "negotiable"] as const).map((v) => (
                      <label key={v} className="flex items-center gap-1">
                        <input
                          type="radio"
                          name="pets_allowed"
                          checked={propertyForm.pets_allowed === v}
                          onChange={() => setPropertyForm({ ...propertyForm, pets_allowed: v })}
                        />
                        {v === "yes" ? "Yes" : v === "no" ? "No" : "Negotiable"}
                      </label>
                    ))}
                  </fieldset>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={propertyForm.furnished}
                      onChange={(e) => setPropertyForm({ ...propertyForm, furnished: e.target.checked })}
                    />
                    Furnished
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={propertyForm.parking}
                      onChange={(e) => setPropertyForm({ ...propertyForm, parking: e.target.checked })}
                    />
                    Parking included
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-slate-600">Amenities:</span>
                  {AMENITY_OPTIONS.map((a) => (
                    <label key={a} className="flex items-center gap-1 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={propertyForm.amenities.includes(a)}
                        onChange={(e) => {
                          setPropertyForm({
                            ...propertyForm,
                            amenities: e.target.checked
                              ? [...propertyForm.amenities, a]
                              : propertyForm.amenities.filter((x) => x !== a),
                          });
                        }}
                      />
                      {a}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
                <p className="mb-2 text-xs font-medium text-slate-600">Photos (optional, max 10, 5MB each, JPG/PNG/WEBP)</p>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 bg-white py-6 transition-colors hover:border-slate-300 hover:bg-slate-50">
                  <input
                    type="file"
                    accept={PHOTO_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(e) => addPendingPhotos(e.target.files)}
                  />
                  <span className="text-sm text-slate-600">Drag and drop or click to upload</span>
                </label>
                {uploadProgress != null && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-slate-700 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{Math.round(uploadProgress)}%</span>
                  </div>
                )}
                {pendingPhotos.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pendingPhotos.map((file, i) => (
                      <div key={i} className="relative inline-block">
                        <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {file.type.startsWith("image/") && (
                            <img src={URL.createObjectURL(file)} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        {i === 0 && (
                          <span className="absolute left-0 top-0 rounded bg-slate-800 px-1 text-[10px] font-medium text-white">Cover</span>
                        )}
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(i)}
                          className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </form>
            {properties.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                Add your first property above. Your apply link will show these listings to applicants.
              </p>
            )}
          </>
        )}
      </section>

      {properties.length > 0 && (
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Your properties</h2>
          <div className="space-y-2">
            {properties.map((p) => (
              <div key={p.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.address}, {p.city}, {p.state}</p>
                  {p.rent != null && <p className="text-xs text-slate-500">${p.rent.toLocaleString()}/mo</p>}
                  {Array.isArray(p.photos) && p.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.photos.map((url, i) => (
                        <div key={url} className="relative inline-block">
                          <img src={url} alt="" className="h-12 w-12 rounded border border-slate-200 object-cover" />
                          {i === 0 && (
                            <span className="absolute left-0 top-0 rounded bg-slate-800 px-1 text-[10px] font-medium text-white">Cover</span>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const res = await fetch("/api/properties/delete-photo", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                                  body: JSON.stringify({ property_id: p.id, photo_url: url }),
                                });
                                if (res.ok) await fetchProperties();
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white"
                            aria-label="Remove photo"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {photoUploadingPropertyId === p.id && uploadProgress != null && (
                    <span className="text-xs text-slate-500">{Math.round(uploadProgress)}%</span>
                  )}
                  <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <input
                      type="file"
                      accept={PHOTO_ACCEPT}
                      multiple
                      className="sr-only"
                      disabled={photoUploadingPropertyId !== null}
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length || (Array.isArray(p.photos) && p.photos.length + files.length > PHOTO_MAX)) return;
                        setPhotoUploadingPropertyId(p.id);
                        setUploadProgress(0);
                        for (let i = 0; i < files.length; i++) {
                          const f = files[i];
                          if (!ALLOWED_PHOTO_TYPES.includes(f.type) || f.size > PHOTO_MAX_SIZE) continue;
                          setUploadProgress(((i + 1) / files.length) * 100);
                          const fd = new FormData();
                          fd.set("property_id", p.id);
                          fd.set("photo", f);
                          await fetch("/api/properties/upload-photo", {
                            method: "POST",
                            headers: getAuthHeaders() as Record<string, string>,
                            body: fd,
                          });
                        }
                        setUploadProgress(null);
                        setPhotoUploadingPropertyId(null);
                        e.target.value = "";
                        await fetchProperties();
                      }}
                    />
                    Add photos
                  </label>
                  {p.is_listed && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Live</span>
                  )}
                  {landlord?.slug && (
                    <button
                      type="button"
                      onClick={() => {
                        const link = `${typeof window !== "undefined" ? window.location.origin : ""}/apply/${landlord.slug}?property=${encodeURIComponent(p.id)}`;
                        navigator.clipboard.writeText(link).then(() => {
                          setCopiedApplyLinkPropertyId(p.id);
                          setTimeout(() => setCopiedApplyLinkPropertyId(null), 2000);
                        });
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {copiedApplyLinkPropertyId === p.id ? "Copied!" : "Copy apply link"}
                    </button>
                  )}
                  <Link
                    href={`/dashboard/properties/${p.id}/listing`}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    {p.is_listed ? "Share listing" : "Create listing"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label htmlFor="property-filter" className="text-sm font-medium text-slate-700">Filter by property:</label>
            <select
              id="property-filter"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}, {p.city}
                </option>
              ))}
            </select>
            {propertyId && (
              <>
                <Link
                  href={`/dashboard/properties/${propertyId}/rent`}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Rent &amp; payments
                </Link>
              </>
            )}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Applications</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : applications.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
            <p className="text-sm text-slate-600">No applications yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Share your apply link with prospective tenants. New applications will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <TenantCard
                key={app.id}
                application={app}
                onRefresh={fetchApplications}
                getAuthHeaders={getAuthHeaders}
                userEmail={session?.user?.email ?? undefined}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Maintenance requests</h2>
        {maintenanceLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : maintenance.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
            <p className="text-sm text-slate-600">No maintenance requests yet.</p>
            <p className="mt-1 text-xs text-slate-500">
              Tenants can submit requests from their portal after they’ve applied and been approved.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {maintenance.map((req) => (
              <MaintenanceCard
                key={req.id}
                request={req}
                onRefresh={fetchMaintenance}
                getAuthHeaders={getAuthHeaders}
              />
            ))}
          </div>
        )}
      </section>

      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="import-modal-title">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h2 id="import-modal-title" className="text-lg font-semibold text-slate-800">Import property from listing</h2>
              <p className="mt-1 text-sm text-slate-600">
                <strong>US:</strong> Enter a full address (e.g. 123 Main St, Austin, TX 78701).<br />
                <strong>UK:</strong> Enter a postcode (e.g. SW1A 1AA) to auto-fill location details.
              </p>
            </div>
            <div className="p-4 space-y-4">
              {/* Step 1: Search */}
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Address or UK postcode…"
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleImportLookup(); } }}
                />
                <button
                  type="button"
                  onClick={handleImportLookup}
                  disabled={importLoading || !importQuery.trim()}
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {importLoading ? "Looking up…" : "Look up"}
                </button>
              </div>

              {importError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  {importError}
                </div>
              )}

              {/* Step 2: Preview card (US) */}
              {importResult && importResult.region === "us" && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-teal-900">{importResult.formattedAddress}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-teal-800">
                    {importResult.bedrooms != null && <span>{importResult.bedrooms} bed{importResult.bedrooms !== 1 ? "s" : ""}</span>}
                    {importResult.bathrooms != null && <span>{importResult.bathrooms} bath{importResult.bathrooms !== 1 ? "s" : ""}</span>}
                    {importResult.squareFootage != null && <span>{importResult.squareFootage.toLocaleString()} sqft</span>}
                    {importResult.yearBuilt != null && <span>Built {importResult.yearBuilt}</span>}
                    {importResult.propertyType && <span>{importResult.propertyType}</span>}
                  </div>
                  {importResult.rentEstimate != null && (
                    <p className="text-xs text-teal-700">
                      Estimated rent: <strong>${importResult.rentEstimate.toLocaleString()}/mo</strong>
                      {importResult.rentRangeLow != null && importResult.rentRangeHigh != null && (
                        <span className="text-teal-600"> (range: ${importResult.rentRangeLow.toLocaleString()}–${importResult.rentRangeHigh.toLocaleString()})</span>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Preview card (UK) */}
              {importResult && importResult.region === "uk" && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-1">
                  <p className="text-sm font-semibold text-teal-900">Postcode: {importResult.postcode}</p>
                  <p className="text-xs text-teal-800">{importResult.city}{importResult.county ? `, ${importResult.county}` : ""}, {importResult.state}</p>
                  <p className="text-xs text-teal-600">Enter the street address and rent below to complete the import.</p>
                </div>
              )}

              {/* Step 3: Editable form fields */}
              {(importResult || importError) && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">Review and confirm details:</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="Street address *"
                      value={importForm.address}
                      onChange={(e) => setImportForm({ ...importForm, address: e.target.value })}
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="City *"
                      value={importForm.city}
                      onChange={(e) => setImportForm({ ...importForm, city: e.target.value })}
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="State / Region *"
                      value={importForm.state}
                      onChange={(e) => setImportForm({ ...importForm, state: e.target.value })}
                    />
                    <input
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      placeholder="ZIP / Postcode *"
                      value={importForm.zip}
                      onChange={(e) => setImportForm({ ...importForm, zip: e.target.value })}
                    />
                  </div>
                  <input
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Monthly rent ($) *"
                    value={importForm.rent}
                    onChange={(e) => setImportForm({ ...importForm, rent: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setImportQuery("");
                  setImportResult(null);
                  setImportError(null);
                  setImportForm({ address: "", city: "", state: "", zip: "", rent: "" });
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              {(importResult || importError) && (
                <button
                  type="button"
                  onClick={handleImportSave}
                  disabled={importSaving || !importForm.address || !importForm.city || !importForm.state || !importForm.zip || !importForm.rent}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {importSaving ? "Saving…" : "Import property"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="border-b border-slate-200 p-4">
              <h2 id="csv-modal-title" className="text-lg font-semibold text-slate-800">Upload properties from CSV</h2>
              <p className="mt-1 text-sm text-slate-600">
                Use a CSV with columns: <strong>address</strong>, <strong>city</strong>, <strong>state</strong>, <strong>zip</strong>, <strong>rent</strong>, <strong>status</strong> (active or inactive), <strong>application_deadline</strong> (optional, YYYY-MM-DD).
              </p>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Choose CSV file
                  <input
                    type="file"
                    accept=".csv"
                    className="sr-only"
                    onChange={handleCsvFileChange}
                  />
                </label>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); downloadCsvTemplate(); }}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  Download CSV Template
                </a>
              </div>
              {csvUploadError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                  {csvUploadError}
                </div>
              )}
              {csvRows.length > 0 && (
                <>
                  <div className="text-sm font-medium text-slate-700">
                    {csvValidCount > 0
                      ? `${csvValidCount} propert${csvValidCount === 1 ? "y" : "ies"} ready to upload`
                      : `Preview (${csvRows.length} row${csvRows.length !== 1 ? "s" : ""})`}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="px-3 py-2 text-left font-medium text-slate-700">#</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Address</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">City</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">State</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">ZIP</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Rent</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Status</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">App deadline</th>
                          <th className="px-3 py-2 text-left font-medium text-slate-700">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.map((row, i) => (
                          <tr
                            key={i}
                            className={`border-b border-slate-100 ${csvRowErrors[i] ? "bg-red-50/50" : ""}`}
                          >
                            <td className="px-3 py-2 text-slate-600">{i + 1}</td>
                            <td className="px-3 py-2">{row.address}</td>
                            <td className="px-3 py-2">{row.city}</td>
                            <td className="px-3 py-2">{row.state}</td>
                            <td className="px-3 py-2">{row.zip}</td>
                            <td className="px-3 py-2">{row.rent}</td>
                            <td className="px-3 py-2">{row.status || "active"}</td>
                            <td className="px-3 py-2">{row.application_deadline || "—"}</td>
                            <td className="px-3 py-2 text-red-600">{csvRowErrors[i] ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-500">
                    Rows with errors are highlighted. Only valid rows will be uploaded when you click Upload All.
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvUploadError(null);
                  setCsvRows([]);
                  setCsvRowErrors([]);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCsvUploadAll}
                disabled={csvRows.length === 0 || csvRowErrors.every((e) => e !== null) || csvUploading}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {csvUploading ? "Uploading…" : "Upload All"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
