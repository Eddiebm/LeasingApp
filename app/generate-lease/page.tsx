"use client";

import Link from "next/link";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FetchSubscriptionProvider } from "../../components/FetchSubscriptionProvider";
import { ProGate } from "../../components/ProGate";

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming",
];

const UK_REGIONS = ["England & Wales", "Scotland", "Northern Ireland"];
const PROPERTY_TYPES_UK = ["House", "Apartment", "Studio", "Room only", "HMO"];
const PROPERTY_TYPES_US = ["House", "Apartment", "Studio", "Room only"];
const FURNISHED_OPTIONS = ["Fully furnished", "Part-furnished", "Unfurnished"];
const LEASE_DURATIONS = ["6 months", "12 months", "Month-to-month", "Custom"];
const PETS_OPTIONS = ["Yes", "No", "With written permission"];
const SMOKING_OPTIONS = ["Yes", "No"];

const STEPS = ["Jurisdiction", "Property", "Landlord", "Tenant", "Special Clauses", "Preview & Download"];

type FormData = {
  country: string;
  region: string;
  state: string;
  propertyAddress: string;
  propertyType: string;
  furnished: string;
  monthlyRent: string;
  securityDeposit: string;
  leaseStartDate: string;
  leaseDuration: string;
  customMonths: string;
  petsAllowed: string;
  smokingAllowed: string;
  landlordName: string;
  landlordAddress: string;
  landlordEmail: string;
  landlordPhone: string;
  tenantNames: string[];
  tenantEmails: string[];
  specialClauses: string;
};

const initialForm: FormData = {
  country: "",
  region: "",
  state: "",
  propertyAddress: "",
  propertyType: "",
  furnished: "",
  monthlyRent: "",
  securityDeposit: "",
  leaseStartDate: "",
  leaseDuration: "",
  customMonths: "",
  petsAllowed: "",
  smokingAllowed: "",
  landlordName: "",
  landlordAddress: "",
  landlordEmail: "",
  landlordPhone: "",
  tenantNames: [""],
  tenantEmails: [""],
  specialClauses: "",
};

const MAX_TENANTS = 4;

function GenerateLeasePageInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(initialForm);
  const [generating, setGenerating] = useState(false);
  const [previewClauses, setPreviewClauses] = useState<string | null>(null);
  const [clauseCount, setClauseCount] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [paidLeaseText, setPaidLeaseText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = form.country === "UK" ? "£" : "$";
  const downloadPrice = form.country === "UK" ? "£15" : "$18";

  const canNext = useCallback(() => {
    if (step === 1) {
      if (!form.country) return false;
      if (form.country === "UK") return !!form.region;
      if (form.country === "USA") return !!form.state;
      return true;
    }
    if (step === 2)
      return (
        form.propertyAddress &&
        form.monthlyRent &&
        form.securityDeposit &&
        form.leaseStartDate &&
        form.leaseDuration &&
        (form.leaseDuration !== "Custom" || !!form.customMonths)
      );
    if (step === 3) return form.landlordName && form.landlordAddress;
    if (step === 4) return form.tenantNames.some((t) => t.trim());
    return true;
  }, [step, form]);

  useEffect(() => {
    const paid = searchParams.get("paid");
    const t = searchParams.get("token");
    if (paid === "1" && t) {
      setToken(t);
      setError(null);
      setStep(6);
      fetch(`/api/generate-lease/fulfill?token=${encodeURIComponent(t)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.leaseText) {
            setPaidLeaseText(data.leaseText);
            if (data.formData && typeof data.formData === "object") {
              const fd = data.formData as Record<string, unknown>;
              setForm((prev) => ({
                ...prev,
                landlordName: String(fd.landlordName ?? prev.landlordName),
                landlordAddress: String(fd.landlordAddress ?? prev.landlordAddress),
                propertyAddress: String(fd.propertyAddress ?? prev.propertyAddress),
                tenantNames: Array.isArray(fd.tenantNames) ? (fd.tenantNames as string[]) : prev.tenantNames,
              }));
            }
          } else setError(data.error || "Could not load lease.");
        })
        .catch(() => setError("Could not load lease."));
    } else if (t) {
      setToken(t);
    }
  }, [searchParams]);

  const addTenant = () => {
    if (form.tenantNames.length >= MAX_TENANTS) return;
    setForm((f) => ({
      ...f,
      tenantNames: [...f.tenantNames, ""],
      tenantEmails: [...f.tenantEmails, ""],
    }));
  };

  const removeTenant = (i: number) => {
    if (form.tenantNames.length <= 1) return;
    setForm((f) => ({
      ...f,
      tenantNames: f.tenantNames.filter((_, j) => j !== i),
      tenantEmails: f.tenantEmails.filter((_, j) => j !== i),
    }));
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setPreviewClauses(null);
    setToken(null);
    try {
      const payload = {
        ...form,
        tenantNames: form.tenantNames.filter((t) => t.trim()),
        tenantEmails: form.tenantEmails.slice(0, form.tenantNames.length),
      };
      const res = await fetch("/api/generate-lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to generate lease.");
        return;
      }
      setPreviewClauses(data.previewClauses ?? null);
      setClauseCount(data.clauseCount ?? 0);
      setToken(data.token ?? null);
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadFull = async () => {
    if (!token) return;
    setError(null);
    try {
      const res = await fetch("/api/generate-lease/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Could not start checkout.");
    } catch (e) {
      setError("Could not start checkout.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!paidLeaseText) return;
    try {
      const res = await fetch("/api/generate-lease-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseText: paidLeaseText,
          landlordName: form.landlordName,
          tenantNames: form.tenantNames.filter((t) => t.trim()),
          propertyAddress: form.propertyAddress,
        }),
      });
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lease.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Failed to download PDF.");
    }
  };

  const propertyTypes = form.country === "UK" ? PROPERTY_TYPES_UK : PROPERTY_TYPES_US;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
          ← Back to home
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          AI Lease Generator
        </h1>
        <p className="mt-1 text-slate-600">
          Create a legally accurate lease agreement for US or UK properties in minutes.
        </p>

        {/* Step progress bar */}
        <nav aria-label="Progress" className="mt-8">
          <ol className="flex items-center justify-between text-sm">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`flex flex-1 items-center ${i < STEPS.length - 1 ? "pr-2 sm:pr-4" : ""}`}
              >
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    step > i + 1 ? "bg-emerald-600 text-white" : step === i + 1 ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {i + 1}
                </span>
                <span className={`ml-1 hidden sm:inline ${step >= i + 1 ? "text-slate-900" : "text-slate-400"}`}>
                  {label}
                </span>
                {i < STEPS.length - 1 && <span className="ml-1 flex-1 border-t border-slate-200 sm:ml-2" aria-hidden />}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Jurisdiction</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700">Country</label>
                <select
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value, region: "", state: "" }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                >
                  <option value="">Select country</option>
                  <option value="UK">United Kingdom</option>
                  <option value="USA">United States</option>
                </select>
              </div>
              {form.country === "UK" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">Region</label>
                  <select
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  >
                    <option value="">Select region</option>
                    {UK_REGIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              )}
              {form.country === "USA" && (
                <div>
                  <label className="block text-sm font-medium text-slate-700">State</label>
                  <select
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Property details</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700">Full property address</label>
                <input
                  type="text"
                  value={form.propertyAddress}
                  onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))}
                  placeholder="Full address"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Property type</label>
                <select
                  value={form.propertyType}
                  onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Select</option>
                  {propertyTypes.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Furnished</label>
                <select
                  value={form.furnished}
                  onChange={(e) => setForm((f) => ({ ...f, furnished: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">Select</option>
                  {FURNISHED_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Monthly rent ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={form.monthlyRent}
                    onChange={(e) => setForm((f) => ({ ...f, monthlyRent: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Security deposit ({currency})</label>
                  <input
                    type="number"
                    min="0"
                    value={form.securityDeposit}
                    onChange={(e) => setForm((f) => ({ ...f, securityDeposit: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  {form.country === "UK" && (
                    <p className="mt-1 text-xs text-slate-500">Cannot exceed 5 weeks&apos; rent (Tenant Fees Act 2019).</p>
                  )}
                  {form.country === "USA" && (
                    <p className="mt-1 text-xs text-slate-500">State-specific limits may apply.</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Lease start date</label>
                  <input
                    type="date"
                    value={form.leaseStartDate}
                    onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Lease duration</label>
                  <select
                    value={form.leaseDuration}
                    onChange={(e) => setForm((f) => ({ ...f, leaseDuration: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {LEASE_DURATIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  {form.leaseDuration === "Custom" && (
                    <input
                      type="number"
                      min="1"
                      placeholder="Months"
                      value={form.customMonths}
                      onChange={(e) => setForm((f) => ({ ...f, customMonths: e.target.value }))}
                      className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Pets allowed</label>
                  <select
                    value={form.petsAllowed}
                    onChange={(e) => setForm((f) => ({ ...f, petsAllowed: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {PETS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Smoking allowed</label>
                  <select
                    value={form.smokingAllowed}
                    onChange={(e) => setForm((f) => ({ ...f, smokingAllowed: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select</option>
                    {SMOKING_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Landlord details</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700">Landlord full name</label>
                <input
                  type="text"
                  value={form.landlordName}
                  onChange={(e) => setForm((f) => ({ ...f, landlordName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Landlord address</label>
                <input
                  type="text"
                  value={form.landlordAddress}
                  onChange={(e) => setForm((f) => ({ ...f, landlordAddress: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Landlord email</label>
                <input
                  type="email"
                  value={form.landlordEmail}
                  onChange={(e) => setForm((f) => ({ ...f, landlordEmail: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Landlord phone</label>
                <input
                  type="tel"
                  value={form.landlordPhone}
                  onChange={(e) => setForm((f) => ({ ...f, landlordPhone: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Tenant details</h2>
              <p className="text-sm text-slate-600">Add up to {MAX_TENANTS} tenants.</p>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700">Tenant name(s)</label>
                  {form.tenantNames.length < MAX_TENANTS && (
                    <button type="button" onClick={addTenant} className="text-sm text-slate-600 hover:text-slate-900">
                      Add another tenant
                    </button>
                  )}
                </div>
                {form.tenantNames.map((name, i) => (
                  <div key={i} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const next = [...form.tenantNames];
                        next[i] = e.target.value;
                        setForm((f) => ({ ...f, tenantNames: next }));
                      }}
                      placeholder="Full name"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                    />
                    <input
                      type="email"
                      value={form.tenantEmails[i] ?? ""}
                      onChange={(e) => {
                        const next = [...form.tenantEmails];
                        next[i] = e.target.value;
                        setForm((f) => ({ ...f, tenantEmails: next }));
                      }}
                      placeholder="Email"
                      className="w-36 rounded-lg border border-slate-300 px-3 py-2 sm:w-44"
                    />
                    {form.tenantNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTenant(i)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Remove tenant"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Special clauses (optional)</h2>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Any additional terms or clauses?
                </label>
                <textarea
                  value={form.specialClauses}
                  onChange={(e) => setForm((f) => ({ ...f, specialClauses: e.target.value }))}
                  placeholder="e.g. Tenant responsible for garden, no subletting, parking space included"
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>
          )}

          {step === 6 && !paidLeaseText && (
            <div className="space-y-4">
              {generating ? (
                <div className="py-8 text-center">
                  <p className="text-slate-600">Generating your lease with AI...</p>
                  <div className="mt-4 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  </div>
                </div>
              ) : !previewClauses && !token ? (
                <>
                  <p className="text-slate-600">Review your details and generate the lease document.</p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
                  >
                    Generate lease
                  </button>
                </>
              ) : previewClauses && token ? (
                <>
                  <h2 className="text-lg font-semibold text-slate-800">Lease preview</h2>
                  <div className="relative">
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800">
                      {previewClauses}
                    </div>
                    <div
                      className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"
                      aria-hidden
                    />
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
                    Your full lease is ready — download to get all clauses.
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={handleDownloadFull}
                      className="rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800"
                    >
                      Download Full Lease — {downloadPrice}
                    </button>
                    <Link
                      href="/dashboard/signup"
                      className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Get unlimited leases — Subscribe from £19/month
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {step === 6 && paidLeaseText && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Your lease</h2>
              <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800">
                {paidLeaseText}
              </div>
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
            </div>
          )}

          {step < 6 && !paidLeaseText && (
            <div className="mt-8 flex justify-between">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => (s < 6 ? s + 1 : s))}
                disabled={!canNext()}
                className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {step === 5 ? "Next: Preview & Download" : "Next"}
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          AI-generated documents are for informational purposes only and do not constitute legal advice.
        </p>
      </div>
    </main>
  );
}

export default function GenerateLeasePage() {
  return (
    <FetchSubscriptionProvider>
      <ProGate feature="AI Lease Generator">
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
          <GenerateLeasePageInner />
        </Suspense>
      </ProGate>
    </FetchSubscriptionProvider>
  );
}
