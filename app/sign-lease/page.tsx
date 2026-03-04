"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SignLeaseContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [info, setInfo] = useState<{
    signed?: boolean;
    signedPdfUrl?: string;
    tenantName?: string;
    propertyAddress?: string;
  } | null>(null);
  const [loading, setLoading] = useState(!!token);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Missing link");
      return;
    }
    fetch(`/api/sign-lease?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        setInfo(data);
        if (data.signed) setError(null);
      })
      .catch(() => setError("Invalid link"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canvasRef.current || info?.signed) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl || dataUrl.length < 100) {
      setError("Please draw your signature");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sign-lease", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, signatureDataUrl: dataUrl })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setInfo({ signed: true, signedPdfUrl: data.signedPdfUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (!canvasRef.current || info?.signed) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let drawing = false;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const getXY = (e: MouseEvent | React.MouseEvent) => ({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
    const start = (e: MouseEvent) => {
      drawing = true;
      const { x, y } = getXY(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent) => {
      if (!drawing) return;
      const { x, y } = getXY(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => { drawing = false; };
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("mouseleave", end);
    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("mouseleave", end);
    };
  }, [info?.signed]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  if (!token || error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <h1 className="text-xl font-semibold text-slate-900">Sign Lease</h1>
        <p className="mt-2 text-slate-600">{error || "This link is invalid or has expired."}</p>
      </div>
    );
  }

  if (info?.signed) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="text-xl font-semibold text-slate-900">Lease signed</h1>
        <p className="mt-2 text-slate-600">Thank you. Your signed lease is ready.</p>
        {info.signedPdfUrl && (
          <a
            href={info.signedPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Download signed lease
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Sign your lease</h1>
      {info?.tenantName && <p className="mt-1 text-sm text-slate-600">Tenant: {info.tenantName}</p>}
      {info?.propertyAddress && <p className="text-sm text-slate-600">Property: {info.propertyAddress}</p>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">Your signature</label>
          <canvas
            ref={canvasRef}
            width={400}
            height={120}
            className="mt-1 block w-full max-w-md border border-slate-300 bg-white"
            style={{ touchAction: "none" }}
          />
          <button type="button" onClick={clearCanvas} className="mt-1 text-sm text-slate-500 underline">
            Clear
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit signature"}
        </button>
      </form>
    </div>
  );
}

export default function SignLeasePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><p className="text-slate-600">Loading…</p></div>}>
      <SignLeaseContent />
    </Suspense>
  );
}
