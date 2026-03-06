"use client";

import { useState, useCallback } from "react";

type Props = {
  listingUrl: string;
  headline: string;
  price: string;
  bedsBaths: string;
  availableFrom: string | null;
  propertyId: string;
};

export function ListingShareRow({ listingUrl, headline, price, bedsBaths, availableFrom }: Props) {
  const [copied, setCopied] = useState(false);

  const available = availableFrom
    ? ` · avail ${new Date(availableFrom).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : "";

  const caption = [
    `🏠 ${headline}`,
    [price, bedsBaths].filter(Boolean).join(" · ") + available,
    "",
    "Apply here 👇",
    listingUrl,
  ].join("\n");

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(caption)}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(listingUrl)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${headline} — ${price}`)}&url=${encodeURIComponent(listingUrl)}`;

  const copyCaption = useCallback(() => {
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [caption]);

  return (
    <div className="space-y-3 border-t border-slate-200 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share this listing</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          💬 WhatsApp
        </a>
        <a
          href={facebookHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          f Facebook
        </a>
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          𝕏 Post
        </a>
        <button
          type="button"
          onClick={copyCaption}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {copied ? "✓ Copied!" : "📋 Copy caption"}
        </button>
      </div>
    </div>
  );
}
