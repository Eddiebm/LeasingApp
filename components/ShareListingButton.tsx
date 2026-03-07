"use client";

import { useState } from "react";

type Props = { url: string; className?: string };

export default function ShareListingButton({ url, className }: Props) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" && url.startsWith("/") ? `${window.location.origin}${url}` : url;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(fullUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={className}
    >
      {copied ? "Copied!" : "Share this listing"}
    </button>
  );
}
