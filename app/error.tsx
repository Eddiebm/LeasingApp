"use client";

import { useEffect } from "react";

export default function Error({
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
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">We&apos;ve been notified. Please try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
