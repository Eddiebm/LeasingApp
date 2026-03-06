"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "../../../lib/supabaseClient";

function DashboardLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setSuccessMessage("Password updated. You can sign in now.");
      router.replace("/dashboard/login", { scroll: false });
    }
  }, [searchParams, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!isSupabaseConfigured) {
      setError("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY as GitHub Secrets and redeploy.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard sign in</h1>
      <p className="text-sm text-slate-600">
        Sign in to manage your properties, applications, and leases.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        {successMessage && (
          <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800" role="status">{successMessage}</p>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700" role="alert">{error}</p>
        )}
        <div>
          <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link href="/dashboard/forgot-password" className="text-xs font-medium text-slate-600 underline hover:no-underline">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[48px] rounded-xl bg-black px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/dashboard/signup" className="font-medium underline py-2 px-2">
          Sign up
        </Link>
      </p>
      <Link href="/" className="block text-center text-sm underline text-slate-600 py-3 px-3">← Back to home</Link>
    </main>
  );
}

export default function DashboardLoginPage() {
  return (
    <Suspense fallback={<main className="space-y-6"><p className="text-slate-500">Loading…</p></main>}>
      <DashboardLoginForm />
    </Suspense>
  );
}
