"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export default function Dashboard() {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [applications, setApplications] = useState<Application[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);

  // Step 1: Load session first, redirect to login if none
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/dashboard/login");
        return;
      }
      setAccessToken(session.access_token);
      setUserEmail(session.user?.email ?? undefined);
      setSessionReady(true);
    });
  }, [router]);

  const getAuthHeaders = useCallback((): HeadersInit => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

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

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bannerman Leasing Dashboard</h1>
          <p className="text-sm text-slate-600">
            Review applications, generate leases, and manage maintenance.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Sign out
        </button>
      </div>

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
          <p className="text-sm text-slate-500">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <TenantCard
                key={app.id}
                application={app}
                onRefresh={fetchApplications}
                getAuthHeaders={getAuthHeaders}
                userEmail={userEmail}
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
          <p className="text-sm text-slate-500">No maintenance requests yet.</p>
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
