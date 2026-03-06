"use client";

import { useState, useEffect } from "react";
import { DOCUMENT_TYPES, DOCUMENT_GROUPS, getDocumentTypeLabel } from "../lib/documentTypes";
import { hasOptionals } from "../lib/documentOptionals";
import DocumentOptionalsModal from "./DocumentOptionalsModal";

type Application = {
  id: string;
  tenantName: string;
  tenantEmail?: string;
  propertyAddress: string;
  status: string;
  creditScore?: number | null;
  income?: number | null;
  rent?: number | null;
  screeningStatus?: "not_paid" | "paid_pending" | "complete";
  tenantPassport?: {
    creditScore: number | null;
    riskLevel?: "low" | "medium" | "high" | null;
    identityVerified?: boolean | null;
    incomeVerified?: boolean | null;
    rightToRent?: string | null;
    passportExpiryDate?: string | null;
  } | null;
};

type Doc = { id: string; type: string; file_url: string; created_at: string };

type Props = {
  application: Application;
  onRefresh: () => void;
  getAuthHeaders?: () => HeadersInit;
  userEmail?: string;
};

export default function TenantCard({ application, onRefresh, getAuthHeaders, userEmail }: Props) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [showDocs, setShowDocs] = useState(false);
  const [leaseSignToken, setLeaseSignToken] = useState<string | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>("");
  const [showOptionalsModal, setShowOptionalsModal] = useState(false);
  const [passport, setPassport] = useState<Application["tenantPassport"] | null>(null);
  const headers = (): HeadersInit => {
    const h: HeadersInit = { "Content-Type": "application/json" };
    if (getAuthHeaders) Object.assign(h, getAuthHeaders());
    return h;
  };

  useEffect(() => {
    if (!showDocs || !application.id) return;
    fetch(`/api/documents?applicationId=${application.id}`, { headers: getAuthHeaders?.() ?? {} })
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]));
  }, [showDocs, application.id, getAuthHeaders]);

  useEffect(() => {
    if (!application.id) return;
    fetch(`/api/tenant-passport/${application.id}`, { headers: getAuthHeaders?.() ?? {} })
      .then((r) => r.json())
      .then((data) => {
        if (data?.passport) {
          setPassport({
            creditScore: data.passport.creditScore ?? null,
            riskLevel: data.passport.riskLevel ?? null,
            identityVerified: data.passport.identityVerified ?? null,
            incomeVerified: data.passport.incomeVerified ?? null,
            rightToRent: data.passport.rightToRent ?? null,
            passportExpiryDate: data.passport.passportExpiryDate ?? null
          });
        } else {
          setPassport(null);
        }
      })
      .catch(() => setPassport(null));
  }, [application.id, getAuthHeaders]);

  const updateStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ status, changedBy: userEmail })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const generateDocument = async (type: string, optionals?: Record<string, unknown>) => {
    if (!type) return;
    setGeneratingDoc(true);
    try {
      const body: Record<string, unknown> = { type, applicationId: application.id, ...optionals };
      if (type === "lease" && !optionals?.moveIn) {
        body.moveIn = body.moveIn ?? new Date().toISOString().slice(0, 10);
        body.deposit = body.deposit ?? application.rent ?? undefined;
      }
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate document");
      }
      const token = res.headers.get("X-Lease-Sign-Token");
      if (token) setLeaseSignToken(token);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? `${type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setSelectedDocType("");
      onRefresh();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to generate document.");
    } finally {
      setGeneratingDoc(false);
    }
  };

  const exportJson = async () => {
    try {
      const res = await fetch(`/api/applications/${application.id}/export`, { headers: getAuthHeaders?.() ?? {} });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `application-${application.id}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Export failed.");
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

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {application.screeningStatus === "not_paid" && (
          <span className="text-amber-700">Screening: pending payment</span>
        )}
        {application.screeningStatus === "paid_pending" && (
          <span className="text-slate-500">Screening: processing</span>
        )}
        {application.screeningStatus === "complete" && (
          <span>
            Screening: complete
            {passport?.creditScore != null ? ` · Credit: ${passport.creditScore}` : application.creditScore != null ? ` · Credit: ${application.creditScore}` : ""}
          </span>
        )}
        {application.income != null && <span>Income: ${application.income}</span>}
        {passport?.identityVerified && <span>Identity: verified</span>}
        {passport?.incomeVerified && <span>Income: verified</span>}
        {passport?.rightToRent && <span>Right to Rent: {passport.rightToRent}</span>}
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
                  {getDocumentTypeLabel(d.type) || d.type}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {leaseSignToken && (
        <p className="mt-2 text-xs text-slate-600">
          Send to tenant:{" "}
          <a
            href={`${typeof window !== "undefined" ? window.location.origin : ""}/sign-lease?token=${leaseSignToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            Sign lease link
          </a>
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateStatus("approved")}
          disabled={application.status === "approved"}
          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => updateStatus("rejected")}
          disabled={application.status === "rejected"}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 disabled:opacity-50"
        >
          Reject
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDocType}
            onChange={(e) => setSelectedDocType(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
            disabled={generatingDoc}
          >
            <option value="">Generate document…</option>
            {DOCUMENT_GROUPS.map((grp) => (
              <optgroup key={grp.id} label={grp.label}>
                {DOCUMENT_TYPES.filter((d) => d.group === grp.id).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedDocType || generatingDoc}
            onClick={() => {
              if (hasOptionals(selectedDocType)) setShowOptionalsModal(true);
              else generateDocument(selectedDocType);
            }}
            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
          >
            {generatingDoc ? "Generating…" : "Generate"}
          </button>
        </div>
        {showOptionalsModal && selectedDocType && (
          <DocumentOptionalsModal
            documentType={selectedDocType}
            defaultMoveIn={new Date().toISOString().slice(0, 10)}
            defaultDeposit={application.rent ?? undefined}
            onConfirm={(payload) => {
              setShowOptionalsModal(false);
              generateDocument(selectedDocType, payload);
            }}
            onCancel={() => setShowOptionalsModal(false)}
          />
        )}
        {getAuthHeaders && (
          <button
            type="button"
            onClick={exportJson}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
          >
            Export
          </button>
        )}
      </div>
    </div>
  );
}
