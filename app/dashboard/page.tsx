"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TenantCard from "../../components/TenantCard";
import MaintenanceCard from "../../components/MaintenanceCard";
import { useSubscription } from "../../components/SubscriptionContext";
import { FREE_PROPERTY_LIMIT } from "../../lib/subscription";
import { supabase } from "../../lib/supabaseClient";

type Property = { id: string; address: string; city: string; state: string; zip: string; rent?: number; is_listed?: boolean; listing_slug?: string | null };
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
  const [applyLink, setApplyLink] = useState("");
  const [propertyForm, setPropertyForm] = useState({
    address: "",
    city: "",
    state: "",
    zip: "",
    rent: ""
  });
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<ParsedCsvRow[]>([]);
  const [csvRowErrors, setCsvRowErrors] = useState<(string | null)[]>([]);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);

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

  const handleCreateProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyForm.address || !propertyForm.city || !propertyForm.state || !propertyForm.zip || !propertyForm.rent) {
      alert("Please fill in all property fields.");
      return;
    }
    setCreatingProperty(true);
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
          rent: propertyForm.rent
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Could not create property.");
        return;
      }
      setPropertyForm({ address: "", city: "", state: "", zip: "", rent: "" });
      await fetchProperties();
    } catch (err) {
      console.error(err);
      alert("There was a problem creating the property.");
    } finally {
      setCreatingProperty(false);
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
            <div className="flex flex-wrap items-center justify-between gap-2">
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
            </div>
            <form onSubmit={handleCreateProperty} className="mt-2 grid gap-2 md:grid-cols-5">
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
              <div key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.address}, {p.city}, {p.state}</p>
                  {p.rent && <p className="text-xs text-slate-500">${p.rent.toLocaleString()}/mo</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.is_listed && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Live</span>
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
          <div className="flex items-center gap-2 pt-1">
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
