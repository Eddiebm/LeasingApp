"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TenantCard from "../../components/TenantCard";
import MaintenanceCard from "../../components/MaintenanceCard";
import { supabase } from "../../lib/supabaseClient";

type Property = { id: string; address: string; city: string; state: string; zip: string; rent?: number };
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

export default function Dashboard() {
  const router = useRouter();
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
      </section>

      {properties.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="property-filter" className="text-sm font-medium text-slate-700">Property:</label>
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
    </main>
  );
}
