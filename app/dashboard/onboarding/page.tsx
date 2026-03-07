"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "profile" | "phone-verify";

export default function DashboardOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("profile");

  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [slug, setSlug] = useState("");
  const [country, setCountry] = useState<"UK" | "US">("US");

  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function formatPhone(raw: string, c: "US" | "UK"): string {
    const digits = raw.replace(/\D/g, "");
    if (raw.startsWith("+")) return raw.replace(/\s/g, "");
    if (c === "US") return digits.length === 10 ? `+1${digits}` : `+${digits}`;
    return digits.startsWith("0") ? `+44${digits.slice(1)}` : `+44${digits}`;
  }

  const handleSendOtp = async () => {
    setOtpError("");
    setOtpLoading(true);
    try {
      const formatted = formatPhone(phone, country);
      const res = await fetch("/api/auth/send-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503) { setPhoneVerified(true); return; }
        setOtpError(data.error || "Failed to send code.");
        return;
      }
      setOtpSent(true);
    } catch { setOtpError("Failed to send code."); }
    finally { setOtpLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setOtpError("");
    setOtpLoading(true);
    try {
      const formatted = formatPhone(phone, country);
      const res = await fetch("/api/auth/verify-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted, token: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setOtpError(data.error || "Invalid code."); return; }
      setPhoneVerified(true);
    } catch { setOtpError("Verification failed."); }
    finally { setOtpLoading(false); }
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      const { supabase } = await import("../../../lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { router.replace("/dashboard/login"); return; }
      const res = await fetch("/api/dashboard/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          fullName: fullName.trim(),
          companyName: companyName.trim() || undefined,
          phone: phone.trim() || undefined,
          slug: slug.trim() || undefined,
          country,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || "Something went wrong."); setStep("profile"); return; }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); setStep("profile"); }
    finally { setLoading(false); }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (phone.trim() && !phoneVerified) { setStep("phone-verify"); return; }
    await submitOnboarding();
  };

  if (step === "phone-verify") {
    return (
      <main className="mx-auto max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Verify your phone</h1>
          <p className="mt-1 text-sm text-slate-600">
            We send a 6-digit code to confirm your number. This helps protect your account and your tenants from fraud.
          </p>
        </div>
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          {otpError && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{otpError}</p>}
          {phoneVerified ? (
            <div className="rounded-lg bg-green-50 p-4 text-center">
              <p className="text-sm font-medium text-green-800">✓ Phone verified successfully</p>
              <button type="button" onClick={submitOnboarding} disabled={loading}
                className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                {loading ? "Saving…" : "Continue to dashboard →"}
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-slate-700">Sending code to: <strong>{phone}</strong></p>
                <p className="text-xs text-slate-500 mt-0.5">Format: {formatPhone(phone, country)}</p>
              </div>
              {!otpSent ? (
                <button type="button" onClick={handleSendOtp} disabled={otpLoading}
                  className="w-full rounded-xl bg-teal-600 px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                  {otpLoading ? "Sending…" : "Send verification code"}
                </button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Enter the 6-digit code</label>
                    <input type="text" inputMode="numeric" maxLength={6} placeholder="123456"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center text-xl font-mono tracking-widest"
                      value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} />
                  </div>
                  <button type="button" onClick={handleVerifyOtp} disabled={otpLoading || otpCode.length < 6}
                    className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
                    {otpLoading ? "Verifying…" : "Verify code"}
                  </button>
                  <button type="button" onClick={handleSendOtp} disabled={otpLoading}
                    className="w-full text-sm text-slate-500 underline">Resend code</button>
                </div>
              )}
              <button type="button" onClick={() => { setPhoneVerified(true); submitOnboarding(); }}
                className="w-full text-xs text-slate-400 underline">Skip phone verification</button>
            </>
          )}
        </div>
        <button type="button" onClick={() => setStep("profile")} className="block text-center text-sm underline text-slate-600">
          ← Back to profile
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Complete your profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;re almost there. Add your details so tenants can apply to your properties.
        </p>
      </div>
      <form onSubmit={handleProfileSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        <fieldset className="space-y-2">
          <legend className="mb-1 block text-sm font-medium text-slate-700">Where are your rental properties located?</legend>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="country" value="US" checked={country === "US"} onChange={() => setCountry("US")} />
            <span>United States</span>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" name="country" value="UK" checked={country === "UK"} onChange={() => setCountry("UK")} />
            <span>United Kingdom</span>
          </label>
        </fieldset>
        <div>
          <label htmlFor="onboarding-fullName" className="mb-1 block text-sm font-medium text-slate-700">Full name *</label>
          <input id="onboarding-fullName" type="text" required
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="onboarding-companyName" className="mb-1 block text-sm font-medium text-slate-700">Company name</label>
          <input id="onboarding-companyName" type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Properties" />
        </div>
        <div>
          <label htmlFor="onboarding-phone" className="mb-1 block text-sm font-medium text-slate-700">
            Phone <span className="text-xs font-normal text-slate-500">(we&apos;ll send a verification code)</span>
          </label>
          <input id="onboarding-phone" type="tel"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder={country === "US" ? "e.g. (415) 555-2671" : "e.g. 07911 123456"} />
          <p className="mt-1 text-xs text-slate-500">Helps verify your identity and protect your tenants from fraud.</p>
        </div>
        <div>
          <label htmlFor="onboarding-slug" className="mb-1 block text-sm font-medium text-slate-700">Apply link slug</label>
          <input id="onboarding-slug" type="text"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="e.g. acme-properties" />
          <p className="mt-1 text-xs text-slate-500">Tenants will apply at: /apply/<strong>{slug || "your-slug"}</strong></p>
        </div>
        <button type="submit" disabled={loading}
          className="w-full rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Saving…" : phone.trim() && !phoneVerified ? "Continue — verify phone →" : "Continue to dashboard"}
        </button>
      </form>
      <Link href="/dashboard" className="block text-center text-sm underline text-slate-600">Back to dashboard</Link>
    </main>
  );
}
