"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";

function getResetRedirect(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/dashboard/reset-password`;
  }
  return "https://leasingapp.pages.dev/dashboard/reset-password";
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: getResetRedirect() });
      if (err) throw err;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <main className="space-y-6">
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-slate-600">
          Check your email for a reset link. If you don&apos;t see it, check your spam folder.
        </p>
        <Link href="/dashboard/login" className="inline-block text-sm font-medium text-slate-700 underline hover:no-underline">
          Back to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Forgot password</h1>
      <p className="text-sm text-slate-600">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>
        )}
        <div>
          <label htmlFor="forgot-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="forgot-email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        <Link href="/dashboard/login" className="font-medium underline">Back to sign in</Link>
      </p>
    </main>
  );
}
