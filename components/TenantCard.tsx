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
  leaseStartAt?: string | null;
  leaseEndAt?: string | null;
  tenantPassport?: {
    creditScore: number | null;
    riskLevel?: "low" | "medium" | "high" | null;
    identityVerified?: boolean | null;
    incomeVerified?: boolean | null;
    rightToRent?: string | null;
    passportExpiryDate?: string | null;
  } | null;
};

type Doc = {
  id: string;
  type: string;
  file_url: string;
  created_at: string;
  signing_token_expires_at?: string | null;
  signed_at?: string | null;
  signed_by_name?: string | null;
  signed_pdf_url?: string | null;
  tenant_email?: string | null;
};

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
  const [showSendForSigningModal, setShowSendForSigningModal] = useState(false);
  const [docForSigning, setDocForSigning] = useState<Doc | null>(null);
  const [signingEmail, setSigningEmail] = useState("");
  const [signingName, setSigningName] = useState("");
  const [sendingSigningLink, setSendingSigningLink] = useState(false);
  const [passport, setPassport] = useState<Application["tenantPassport"] | null>(null);
  const [showLeaseDatesForm, setShowLeaseDatesForm] = useState(false);
  const [leaseStartEdit, setLeaseStartEdit] = useState(application.leaseStartAt ?? "");
  const [leaseEndEdit, setLeaseEndEdit] = useState(application.leaseEndAt ?? "");
  const [savingLeaseDates, setSavingLeaseDates] = useState(false);
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
    setLeaseStartEdit(application.leaseStartAt ?? "");
    setLeaseEndEdit(application.leaseEndAt ?? "");
  }, [application.leaseStartAt, application.leaseEndAt]);

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

  const saveLeaseDates = async () => {
    setSavingLeaseDates(true);
    try {
      const start = leaseStartEdit.trim();
      const end = leaseEndEdit.trim();
      const res = await fetch(`/api/applications/${application.id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({
          status: application.status,
          changedBy: userEmail,
          leaseStartAt: start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null,
          leaseEndAt: end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : null
        })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to save");
      setShowLeaseDatesForm(false);
      onRefresh();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to save lease dates.");
    } finally {
      setSavingLeaseDates(false);
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
        <p className="text-xs font-medium text-slate-600">Lease term</p>
        {!showLeaseDatesForm ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700">
            {application.leaseStartAt || application.leaseEndAt ? (
              <>
                {application.leaseStartAt && <span>Start: {new Date(application.leaseStartAt).toLocaleDateString()}</span>}
                {application.leaseEndAt && <span>End: {new Date(application.leaseEndAt).toLocaleDateString()}</span>}
                <button type="button" onClick={() => setShowLeaseDatesForm(true)} className="text-blue-600 underline">Edit</button>
              </>
            ) : (
              <>
                <span className="text-slate-500">Not set</span>
                <button type="button" onClick={() => setShowLeaseDatesForm(true)} className="text-blue-600 underline">Set lease dates</button>
              </>
            )}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-slate-600">Start</label>
              <input
                type="date"
                value={leaseStartEdit}
                onChange={(e) => setLeaseStartEdit(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
              <label className="text-xs text-slate-600">End</label>
              <input
                type="date"
                value={leaseEndEdit}
                onChange={(e) => setLeaseEndEdit(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveLeaseDates} disabled={savingLeaseDates} className="rounded bg-slate-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50">
                {savingLeaseDates ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => { setShowLeaseDatesForm(false); setLeaseStartEdit(application.leaseStartAt ?? ""); setLeaseEndEdit(application.leaseEndAt ?? ""); }} className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700">
                Cancel
              </button>
            </div>
          </div>
        )}
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
          <ul className="mt-1 space-y-2 text-xs">
            {docs.length === 0 && <li className="text-slate-500">No documents yet.</li>}
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <a href={d.signed_pdf_url || d.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  {getDocumentTypeLabel(d.type) || d.type}
                </a>
                {d.type === "lease" && (
                  <>
                    {d.signed_at ? (
                      <span className="text-emerald-600">
                        ✓ Signed {new Date(d.signed_at).toLocaleDateString()}
                        {d.signed_pdf_url && (
                          <a href={d.signed_pdf_url} target="_blank" rel="noopener noreferrer" className="ml-1 underline">
                            Download
                          </a>
                        )}
                      </span>
                    ) : d.signing_token_expires_at ? (
                      <span className="text-slate-500">Awaiting signature</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDocForSigning(d);
                          setSigningEmail(application.tenantEmail ?? "");
                          setSigningName(application.tenantName ?? "");
                          setShowSendForSigningModal(true);
                        }}
                        className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
                      >
                        Send for signing
                      </button>
                    )}
                  </>
                )}
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

      {showSendForSigningModal && docForSigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="send-signing-title">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
            <h2 id="send-signing-title" className="text-lg font-semibold">Send lease for signing</h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!docForSigning || sendingSigningLink) return;
                setSendingSigningLink(true);
                try {
                  const res = await fetch("/api/documents/send-for-signing", {
                    method: "POST",
                    headers: headers(),
                    body: JSON.stringify({
                      documentId: docForSigning.id,
                      tenantEmail: signingEmail.trim(),
                      tenantName: signingName.trim()
                    })
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Failed to send");
                  setShowSendForSigningModal(false);
                  setDocForSigning(null);
                  setSigningEmail("");
                  setSigningName("");
                  if (showDocs) {
                    fetch(`/api/documents?applicationId=${application.id}`, { headers: getAuthHeaders?.() ?? {} })
                      .then((r) => r.json())
                      .then((d) => setDocs(Array.isArray(d) ? d : []))
                      .catch(() => {});
                  }
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Failed to send signing link.");
                } finally {
                  setSendingSigningLink(false);
                }
              }}
            >
              <div>
                <label htmlFor="signing-email" className="block text-sm font-medium text-slate-700">Tenant email</label>
                <input
                  id="signing-email"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  value={signingEmail}
                  onChange={(e) => setSigningEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="signing-name" className="block text-sm font-medium text-slate-700">Tenant name</label>
                <input
                  id="signing-name"
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Full legal name"
                  value={signingName}
                  onChange={(e) => setSigningName(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={sendingSigningLink}
                  className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {sendingSigningLink ? "Sending…" : "Send signing link"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSendForSigningModal(false); setDocForSigning(null); }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
