"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ReportError({
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
      <h1 className="text-xl font-semibold text-slate-900">Report error</h1>
      <p className="mt-2 text-slate-600">We couldn&apos;t submit your request. Please try again.</p>
      <div className="mt-4 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
          Home
        </Link>
      </div>
    </div>
  );
}
