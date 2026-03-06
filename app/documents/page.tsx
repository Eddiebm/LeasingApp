"use client";
import Link from "next/link";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type Message = { role: "user" | "assistant"; content: string };

const PREVIEW_CHARS = 700;

function DocumentsPageInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [documentLabel, setDocumentLabel] = useState<string>("document");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidDoc, setPaidDoc] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isLease = documentType === "ast_lease" || documentType === "rent_increase" || documentType === "lease";
  const downloadPrice = isLease ? "£15" : "£10";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, documentText, paidDoc]);

  useEffect(() => {
    const paid = searchParams.get("paid");
    const token = searchParams.get("token");
    if (paid === "1" && token) {
      setError(null);
      fetch(`/api/documents/fulfill?token=${encodeURIComponent(token)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.documentText) setPaidDoc(data.documentText);
          else setError(data.error || "Could not load document.");
        })
        .catch(() => setError("Could not load document."));
    }
  }, [searchParams]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    if (!documentText && !paidDoc) {
      setDocumentText(null);
      setDocumentType(null);
    }
    const userMessage: Message = { role: "user", content: text };
    setMessages((m) => [...m, userMessage]);
    setLoading(true);

    try {
      const res = await fetch("/api/documents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setMessages((m) => m.slice(0, -1));
        setLoading(false);
        return;
      }

      if (data.ready && data.documentText) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `I have everything I need. Generating your ${data.documentLabel ?? "document"} now...`,
          },
        ]);
        setDocumentText(data.documentText);
        setDocumentType(data.documentType ?? null);
        setDocumentLabel(data.documentLabel ?? "document");
      } else if (data.message) {
        setMessages((m) => [...m, { role: "assistant", content: data.message }]);
      }
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setMessages((m) => m.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const payToDownload = async () => {
    if (!documentText || !documentType) return;
    setError(null);
    try {
      const res = await fetch("/api/documents/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText, documentType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Could not start checkout.");
    } catch (e) {
      setError("Could not start checkout.");
    }
  };

  const downloadPdf = async () => {
    const text = paidDoc ?? documentText;
    if (!text) return;
    setError(null);
    try {
      const res = await fetch("/api/generate-eviction-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentText: text,
          noticeType: isLease ? "Lease" : "Eviction Notice",
        }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = isLease ? "lease.pdf" : "eviction-notice.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Could not download PDF.");
    }
  };

  const showPaidFlow = !!paidDoc;
  const showPreview = !!documentText && !paidDoc;

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 py-6">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 mb-4">
          ← Back
        </Link>

        <h1 className="text-xl font-semibold text-slate-900 mb-1">
          Get a lease or eviction notice
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Describe your situation in plain English. I’ll ask one question at a time, then generate your document.
        </p>

        <div className="flex-1 space-y-4 mb-6 min-h-0 overflow-y-auto">
          {messages.length === 0 && !showPreview && !showPaidFlow && (
            <p className="text-slate-500 text-sm">
              e.g. “I need a lease for my flat in London” or “My tenant hasn’t paid rent for 2 months”
            </p>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-800"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white border border-slate-200 px-4 py-3 text-sm text-slate-500">
                Thinking…
              </div>
            </div>
          )}

          {showPreview && documentText && (
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="relative p-4 border-b border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Preview</p>
                <div className="text-sm text-slate-800 whitespace-pre-wrap">
                  {documentText.slice(0, PREVIEW_CHARS)}
                  {documentText.length > PREVIEW_CHARS && "…"}
                </div>
                {documentText.length > PREVIEW_CHARS && (
                  <div
                    className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none"
                    aria-hidden
                  />
                )}
              </div>
              <div className="p-6 text-center">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Your document is ready</h3>
                <button
                  type="button"
                  onClick={payToDownload}
                  className="block w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-medium text-white hover:bg-slate-800"
                >
                  Download PDF — {downloadPrice}
                </button>
                <p className="mt-1.5 text-xs text-slate-500">One-time payment, no account</p>
                <p className="my-4 text-xs text-slate-400">─────────── or ───────────</p>
                <Link
                  href="/dashboard/signup"
                  className="block w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-800 hover:bg-slate-50"
                >
                  Get unlimited documents
                </Link>
                <p className="mt-1.5 text-xs text-slate-500">Subscribe from £19/month</p>
                <p className="text-xs text-slate-500">Includes e-signature + dashboard</p>
              </div>
            </div>
          )}

          {showPaidFlow && paidDoc && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Your document is ready.</p>
              <div className="max-h-48 overflow-y-auto text-sm text-slate-800 whitespace-pre-wrap mb-3">
                {paidDoc}
              </div>
              <button
                type="button"
                onClick={downloadPdf}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Download PDF
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
            placeholder={messages.length === 0 ? "Type your situation…" : "Type your reply…"}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
            disabled={loading}
          />
          <button
            type="button"
            onClick={send}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:pointer-events-none"
          >
            {messages.length === 0 ? "Generate" : "Send"}
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 py-4">
        AI-generated documents are for information only, not legal advice.
      </p>
    </main>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>}>
      <DocumentsPageInner />
    </Suspense>
  );
}
