"use client";

import { useState, useEffect } from "react";
import TenantCard from "../../components/TenantCard";

type Application = {
  id: string;
  tenantName: string;
  propertyAddress: string;
  status: string;
  creditScore?: number | null;
  income?: number | null;
  rent?: number | null;
};

export default function Dashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    try {
      const res = await fetch("/api/applications");
      if (res.ok) {
        const data = await res.json();
        setApplications(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Bannerman Leasing Dashboard</h1>
      <p className="text-sm text-slate-600">
        Review tenant applications, screening results, and generate leases.
      </p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Applications</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-slate-500">No applications yet.</p>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <TenantCard key={app.id} application={app} onRefresh={fetchApplications} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
