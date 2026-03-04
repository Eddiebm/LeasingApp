"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Dashboard error</h1>
      <p className="mt-2 text-slate-600">Something went wrong. You can try again or sign in again.</p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link href="/dashboard/login" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Sign in
        </Link>
      </div>
    </div>
  );
}
