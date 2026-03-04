"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function DashboardLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
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
        Use the email and password you created in Supabase (Authentication → Users).
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
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
          <label htmlFor="login-password" className="mb-1 block text-sm font-medium text-slate-700">Password</label>
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
      <Link href="/" className="block text-center text-sm underline text-slate-600">Back to home</Link>
    </main>
  );
}
