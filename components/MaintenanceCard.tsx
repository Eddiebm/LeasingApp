"use client";

type Request = {
  id: string;
  category: string;
  description: string;
  photoUrl: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
};

type Props = {
  request: Request;
  onRefresh: () => void;
  getAuthHeaders?: () => HeadersInit;
};

const CATEGORY_LABELS: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "HVAC",
  appliance: "Appliance",
  pest: "Pest",
  other: "Other"
};

export default function MaintenanceCard({ request, onRefresh, getAuthHeaders }: Props) {
  const updateStatus = async (status: string) => {
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (getAuthHeaders) Object.assign(headers, getAuthHeaders());
      const res = await fetch(`/api/maintenance/${request.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status })
      });
      if (res.ok) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const statusColor =
    request.status === "resolved"
      ? "bg-emerald-100 text-emerald-800"
      : request.status === "in_progress"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full px-2 py-0.5 text-xs font-medium text-slate-600">
          {CATEGORY_LABELS[request.category] ?? request.category}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
          {request.status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium text-slate-900">{request.tenantName}</p>
      <p className="text-xs text-slate-500">{request.propertyAddress}</p>
      <p className="mt-2 text-sm text-slate-700">{request.description}</p>
      {request.photoUrl && (
        <a
          href={request.photoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-blue-600 underline"
        >
          View photo
        </a>
      )}
      <p className="mt-1 text-xs text-slate-400">
        Submitted {new Date(request.createdAt).toLocaleDateString()}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {request.status === "submitted" && (
          <button
            type="button"
            onClick={() => updateStatus("in_progress")}
            className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            Mark in progress
          </button>
        )}
        {(request.status === "submitted" || request.status === "in_progress") && (
          <button
            type="button"
            onClick={() => updateStatus("resolved")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            Mark resolved
          </button>
        )}
      </div>
    </div>
  );
}
