"use client";

import Link from "next/link";
import { useState } from "react";
import { FetchSubscriptionProvider } from "../../components/FetchSubscriptionProvider";
import { ProGate } from "../../components/ProGate";

const UK_TENANCY_TYPES = [
  "Assured Shorthold Tenancy",
  "Common law tenancy",
  "Licence to occupy",
];

const UK_REASONS = [
  "Rent arrears",
  "Anti-social behaviour",
  "Property damage",
  "Landlord wants to sell",
  "Landlord wants to move in",
  "End of fixed term",
  "Other",
];

const US_REASONS = [
  "Non-payment of rent",
  "Lease violation",
  "Property damage",
  "End of lease",
  "Illegal activity",
  "Other",
];

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

type Answers = {
  country: string;
  tenancyType: string;
  state: string;
  reason: string;
  rentOwed: string;
  previousNotice: string;
  previousNoticeType: string;
  previousNoticeWhen: string;
  landlordName: string;
  landlordAddress: string;
  tenantName: string;
  tenantAddress: string;
  propertyAddress: string;
};

const initialAnswers: Answers = {
  country: "USA",
  tenancyType: "",
  state: "",
  reason: "",
  rentOwed: "",
  previousNotice: "",
  previousNoticeType: "",
  previousNoticeWhen: "",
  landlordName: "",
  landlordAddress: "",
  tenantName: "",
  tenantAddress: "",
  propertyAddress: "",
};

type Result = {
  noticeType: string;
  noticePeriod: string;
  documentText: string;
  nextSteps: string[];
};

export default function EvictionPage() {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [currentQ, setCurrentQ] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalSteps = 8;
  const progressStep = currentQ === 5.5 ? 5.5 : currentQ;
  const progress = result ? 100 : (progressStep / totalSteps) * 100;

  const update = (key: keyof Answers, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
  };

  const next = () => {
    if (currentQ < totalSteps) setCurrentQ((q) => q + 1);
  };

  const back = () => {
    if (currentQ > 1) setCurrentQ((q) => q - 1);
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-eviction-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to generate notice.");
        return;
      }
      setResult({
        noticeType: data.noticeType ?? "Eviction notice",
        noticePeriod: data.noticePeriod ?? "",
        documentText: data.documentText ?? "",
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
      });
    } catch (e) {
      setError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!result) return;
    try {
      const res = await fetch("/api/generate-eviction-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: result.documentText,
          noticeType: result.noticeType,
        }),
      });
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "eviction-notice.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Failed to download PDF.");
    }
  };

  const reasons = answers.country === "UK" ? UK_REASONS : US_REASONS;
  const isRentArrears =
    answers.reason?.toLowerCase().includes("rent") ||
    answers.reason?.toLowerCase().includes("arrears") ||
    answers.reason?.toLowerCase().includes("payment");

  return (
    <FetchSubscriptionProvider>
      <ProGate feature="Eviction Notice Generator">
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-xl">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
              ← Back to home
            </Link>

            <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
              AI Eviction Assistant
            </h1>
            <p className="mt-1 text-slate-600">
              Get the right eviction notice for your situation — generated in minutes.
            </p>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!result && currentQ === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Which country is the property in?
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    update("country", "UK");
                    next();
                  }}
                  className="flex-1 rounded-lg border-2 border-slate-300 px-4 py-3 text-left font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                >
                  UK
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update("country", "USA");
                    next();
                  }}
                  className="flex-1 rounded-lg border-2 border-slate-300 px-4 py-3 text-left font-medium text-slate-800 hover:border-slate-400 hover:bg-slate-50"
                >
                  USA
                </button>
              </div>
            </div>
          )}

          {!result && currentQ === 2 && answers.country === "UK" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                What type of tenancy is it?
              </h2>
              <div className="space-y-2">
                {UK_TENANCY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      update("tenancyType", t);
                      next();
                    }}
                    className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-left text-slate-800 hover:bg-slate-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && currentQ === 2 && answers.country === "USA" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Which state?</h2>
              <select
                value={answers.state}
                onChange={(e) => {
                  update("state", e.target.value);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={next}
                disabled={!answers.state}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {!result && currentQ === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                What is the reason for eviction?
              </h2>
              <div className="space-y-2">
                {reasons.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      update("reason", r);
                      next();
                    }}
                    className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-left text-slate-800 hover:bg-slate-50"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!result && currentQ === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                {isRentArrears
                  ? "How many months/weeks of rent are owed?"
                  : "How many months/weeks of rent are owed? (if applicable)"}
              </h2>
              <input
                type="text"
                value={answers.rentOwed}
                onChange={(e) => update("rentOwed", e.target.value)}
                placeholder="e.g. 2 months"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={next}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white"
              >
                Next
              </button>
            </div>
          )}

          {!result && currentQ === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Has a previous notice been served?
              </h2>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    update("previousNotice", "Yes");
                    setCurrentQ(5.5);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 font-medium hover:bg-slate-50"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update("previousNotice", "No");
                    update("previousNoticeType", "");
                    update("previousNoticeWhen", "");
                    next();
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 font-medium hover:bg-slate-50"
                >
                  No
                </button>
              </div>
            </div>
          )}

          {!result && currentQ === 5.5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">
                What type of notice and when?
              </h2>
              <input
                type="text"
                value={answers.previousNoticeType}
                onChange={(e) => update("previousNoticeType", e.target.value)}
                placeholder="Notice type (e.g. Section 21)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                value={answers.previousNoticeWhen}
                onChange={(e) => update("previousNoticeWhen", e.target.value)}
                placeholder="Date served"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setCurrentQ(6)}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white"
              >
                Next
              </button>
            </div>
          )}

          {!result && currentQ === 6 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Landlord name and address</h2>
              <input
                type="text"
                value={answers.landlordName}
                onChange={(e) => update("landlordName", e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                value={answers.landlordAddress}
                onChange={(e) => update("landlordAddress", e.target.value)}
                placeholder="Address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={next}
                disabled={!answers.landlordName.trim()}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {!result && currentQ === 7 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Tenant name and address</h2>
              <input
                type="text"
                value={answers.tenantName}
                onChange={(e) => update("tenantName", e.target.value)}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <input
                type="text"
                value={answers.tenantAddress}
                onChange={(e) => update("tenantAddress", e.target.value)}
                placeholder="Address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <button
                type="button"
                onClick={next}
                disabled={!answers.tenantName.trim()}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {!result && currentQ === 8 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-800">Property address</h2>
              <input
                type="text"
                value={answers.propertyAddress}
                onChange={(e) => update("propertyAddress", e.target.value)}
                placeholder="Full property address"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              {generating ? (
                <div className="py-6 text-center">
                  <p className="text-slate-600">Generating your notice...</p>
                  <div className="mt-4 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!answers.propertyAddress.trim()}
                  className="w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white disabled:opacity-50"
                >
                  Generate notice
                </button>
              )}
            </div>
          )}

          {result && (
            <div className="space-y-6">
              <div className="rounded-lg bg-slate-100 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">
                  Based on your answers, you need to serve a{" "}
                  <strong>{result.noticeType}</strong> notice.
                </p>
                {result.noticePeriod && (
                  <p className="mt-1 text-sm text-slate-600">
                    You must give the tenant <strong>{result.noticePeriod}</strong> notice.
                  </p>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm whitespace-pre-wrap text-slate-800">
                {result.documentText}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800"
                >
                  Download Notice (PDF)
                </button>
                <Link
                  href="/dashboard/signup"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Track this eviction case
                </Link>
              </div>
              {result.nextSteps.length > 0 && (
                <div className="border-t border-slate-200 pt-6">
                  <h3 className="text-lg font-semibold text-slate-800">What happens next</h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-slate-700">
                    {result.nextSteps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-slate-500">{i + 1}.</span>
                        <span>{step}</span>
                        <Link
                          href="/dashboard/signup"
                          className="ml-auto shrink-0 text-sm font-medium text-slate-900 hover:underline"
                        >
                          Track this step
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}

          {!result && currentQ > 1 && currentQ <= 8 && (
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => setCurrentQ(currentQ === 5.5 ? 5 : currentQ === 6 && answers.previousNotice === "Yes" ? 5.5 : currentQ - 1)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Back
              </button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          AI-generated documents are for informational purposes only and do not constitute legal advice.
        </p>
          </div>
        </main>
      </ProGate>
    </FetchSubscriptionProvider>
  );
}
