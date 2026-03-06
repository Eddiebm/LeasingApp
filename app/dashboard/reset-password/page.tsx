"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Supabase puts token in URL hash; ensure client has processed it
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash && !searchParams.get("next")) {
      // Optional: could show "use the link from your email" if no hash
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPassword });
      if (err) throw err;
      router.replace("/dashboard/login?reset=success");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Set new password</h1>
      <p className="text-sm text-slate-600">
        Enter your new password below. Use the link from your email to get here.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>
        )}
        <div>
          <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-700">New password</label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        <Link href="/dashboard/login" className="font-medium underline">Back to sign in</Link>
      </p>
    </main>
  );
}
