"use client";

import { useState, useEffect } from "react";

type Application = {
  id: string;
  tenantName: string;
  propertyAddress: string;
  status: string;
  creditScore?: number | null;
  income?: number | null;
  rent?: number | null;
};

type Doc = { id: string; type: string; file_url: string; created_at: string };

type Props = {
  application: Application;
  onRefresh: () => void;
};

export default function TenantCard({ application, onRefresh }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    if (!showDocs || !application.id) return;
    fetch(`/api/documents?applicationId=${application.id}`)
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]));
  }, [showDocs, application.id]);

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const generateLease = async () => {
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant: application.tenantName,
          property: application.propertyAddress,
          rent: application.rent ?? 0,
          deposit: application.rent ?? 0,
          moveIn: new Date().toISOString().slice(0, 10),
          landlord: "Eddie Bannerman-Menson",
          applicationId: application.id
        })
      });
      if (!res.ok) throw new Error("Failed to generate");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lease.pdf";
      a.click();
      URL.revokeObjectURL(url);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert("Failed to generate lease.");
    }
  };

  const statusColor =
    application.status === "approved"
      ? "bg-emerald-100 text-emerald-800"
      : application.status === "rejected"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{application.tenantName}</p>
          <p className="text-xs text-slate-500">{application.propertyAddress}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
          {application.status}
        </span>
      </div>

      <div className="mt-3 flex gap-4 text-xs text-slate-600">
        {application.creditScore != null && <span>Credit: {application.creditScore}</span>}
        {application.income != null && <span>Income: ${application.income}</span>}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowDocs((s) => !s)}
          className="text-xs font-medium text-slate-600 underline"
        >
          {showDocs ? "Hide" : "View"} documents
        </button>
        {showDocs && (
          <ul className="mt-1 space-y-1 text-xs">
            {docs.length === 0 && <li className="text-slate-500">No documents yet.</li>}
            {docs.map((d) => (
              <li key={d.id}>
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {d.type}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => updateStatus("approved")}
          disabled={application.status === "approved"}
          className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => updateStatus("rejected")}
          disabled={application.status === "rejected"}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={generateLease}
          className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white"
        >
          Generate Lease
        </button>
      </div>
    </div>
  );
}
