"use client";

import { useState, useEffect } from "react";

type Step = 1 | 2 | 3 | 4;

type Property = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  rent: number;
  status: string;
};

type ApplicationFormProps = {
  landlordSlug?: string;
  initialPropertyId?: string;
};

export default function ApplicationForm({ landlordSlug, initialPropertyId }: ApplicationFormProps) {
  const [step, setStep] = useState<Step>(1);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);

  // Fraud report state
  const [showFraudModal, setShowFraudModal] = useState(false);
  const [fraudReason, setFraudReason] = useState("");
  const [fraudDetails, setFraudDetails] = useState("");
  const [fraudEmail, setFraudEmail] = useState("");
  const [fraudSubmitting, setFraudSubmitting] = useState(false);
  const [fraudSubmitted, setFraudSubmitted] = useState(false);

  const [form, setForm] = useState({
    propertyId: initialPropertyId ?? "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    dob: "",
    currentAddress: "",
    previousLandlord: "",
    monthlyRent: "",
    reasonForLeaving: "",
    employer: "",
    position: "",
    monthlyIncome: "",
    yearsEmployed: "",
    creditConsent: false,
    backgroundConsent: false,
    signature: ""
  });

  useEffect(() => {
    const query = landlordSlug ? `?slug=${encodeURIComponent(landlordSlug)}` : "";
    fetch(`/api/properties${query}`)
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]));
  }, [landlordSlug]);

  useEffect(() => {
    if (initialPropertyId) setForm((f) => ({ ...f, propertyId: initialPropertyId }));
  }, [initialPropertyId]);

  const handleFraudReport = async () => {
    if (!fraudReason) return;
    setFraudSubmitting(true);
    try {
      await fetch("/api/fraud-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId || null,
          reporterEmail: fraudEmail,
          reason: fraudReason,
          details: fraudDetails,
        }),
      });
      setFraudSubmitted(true);
    } catch { /* silent */ }
    finally { setFraudSubmitting(false); }
  };

  const next = () => setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const handleSubmit = async () => {
    if (!form.creditConsent || !form.backgroundConsent || !form.signature) {
      alert("Please provide consent and signature to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId || null,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          email: form.email,
          dob: form.dob,
          currentAddress: form.currentAddress,
          previousLandlord: form.previousLandlord,
          monthlyRent: form.monthlyRent,
          reasonForLeaving: form.reasonForLeaving,
          employer: form.employer,
          position: form.position,
          monthlyIncome: form.monthlyIncome,
          yearsEmployed: form.yearsEmployed,
          creditConsent: form.creditConsent,
          backgroundConsent: form.backgroundConsent,
          signature: form.signature,
          landlordSlug: landlordSlug || undefined
        })
      });

      if (!res.ok) {
        const text = await res.text();
        let msg = "Failed to submit application";
        try {
          const err = JSON.parse(text);
          if (err?.error) msg = err.error;
        } catch {
          if (text) msg = text.slice(0, 100);
        }
        throw new Error(`${msg} [${res.status}]`);
      }

      const data = await res.json().catch(() => ({}));
      const appId = data.applicationId;
      if (appId) {
        window.location.href = `/apply/success?applicationId=${encodeURIComponent(appId)}&email=${encodeURIComponent(form.email)}`;
        return;
      }
      alert("Application submitted. We'll be in touch soon.");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "There was a problem submitting your application.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
        <span>Step {step} of 4</span>
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Basic Info</h2>

          {properties.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Property</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={form.propertyId}
                onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
              >
                <option value="">Select a property</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.address}, {p.city} – ${p.rent}/mo
                  </option>
                ))}
              </select>
            </div>
          )}

          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="First Name"
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Last Name"
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Housing History</h2>

          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Current Address"
            value={form.currentAddress}
            onChange={(e) => setForm({ ...form, currentAddress: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Previous Landlord"
            value={form.previousLandlord}
            onChange={(e) => setForm({ ...form, previousLandlord: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Monthly Rent"
            value={form.monthlyRent}
            onChange={(e) => setForm({ ...form, monthlyRent: e.target.value })}
          />
          <textarea
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Reason for Leaving"
            value={form.reasonForLeaving}
            onChange={(e) => setForm({ ...form, reasonForLeaving: e.target.value })}
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Employment</h2>

          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Employer"
            value={form.employer}
            onChange={(e) => setForm({ ...form, employer: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Position"
            value={form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Monthly Income"
            value={form.monthlyIncome}
            onChange={(e) => setForm({ ...form, monthlyIncome: e.target.value })}
          />
          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Years Employed"
            value={form.yearsEmployed}
            onChange={(e) => setForm({ ...form, yearsEmployed: e.target.value })}
          />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Consent</h2>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.creditConsent}
              onChange={(e) => setForm({ ...form, creditConsent: e.target.checked })}
            />
            <span>Credit Check Authorization</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.backgroundConsent}
              onChange={(e) => setForm({ ...form, backgroundConsent: e.target.checked })}
            />
            <span>Background Check Authorization</span>
          </label>

          <input
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="Digital Signature (type your full name)"
            value={form.signature}
            onChange={(e) => setForm({ ...form, signature: e.target.value })}
          />
        </div>
      )}

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={back}
          disabled={step === 1}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-40"
        >
          Back
        </button>

        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded-lg bg-black px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Submitting..." : "Submit Application"}
          </button>
        )}
      </div>
      {/* Fraud report link */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={() => setShowFraudModal(true)}
          className="text-xs text-slate-400 underline hover:text-red-500"
        >
          Report this listing as suspicious
        </button>
      </div>

      {/* Fraud report modal */}
      {showFraudModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            {fraudSubmitted ? (
              <div className="text-center space-y-3">
                <p className="text-2xl">&#10003;</p>
                <p className="font-medium text-slate-800">Report submitted</p>
                <p className="text-sm text-slate-600">Thank you for helping keep the platform safe. We&apos;ll review this listing.</p>
                <button type="button" onClick={() => setShowFraudModal(false)}
                  className="w-full rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold text-slate-900">Report suspicious listing</h3>
                  <p className="text-xs text-slate-500 mt-1">Help us protect renters. All reports are reviewed by our team.</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Reason *</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={fraudReason}
                    onChange={(e) => setFraudReason(e.target.value)}
                  >
                    <option value="">Select a reason&hellip;</option>
                    <option value="not_owner">Landlord does not own this property</option>
                    <option value="fake_listing">This listing does not exist</option>
                    <option value="scam">Asking for money upfront / scam</option>
                    <option value="wrong_info">Incorrect property information</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Details (optional)</label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Tell us more about what you noticed&hellip;"
                    value={fraudDetails}
                    onChange={(e) => setFraudDetails(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Your email (optional)</label>
                  <input type="email"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="So we can follow up if needed"
                    value={fraudEmail}
                    onChange={(e) => setFraudEmail(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowFraudModal(false)}
                    className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
                    Cancel
                  </button>
                  <button type="button" onClick={handleFraudReport}
                    disabled={!fraudReason || fraudSubmitting}
                    className="flex-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {fraudSubmitting ? "Submitting&hellip;" : "Submit report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
