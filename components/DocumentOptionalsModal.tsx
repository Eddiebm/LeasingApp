"use client";

import { useState, useEffect } from "react";
import { getOptionalsForType } from "../lib/documentOptionals";

type OptionalPayload = Record<string, unknown>;

type Props = {
  documentType: string;
  defaultMoveIn?: string;
  defaultDeposit?: number;
  onConfirm: (payload: OptionalPayload) => void;
  onCancel: () => void;
};

export default function DocumentOptionalsModal({
  documentType,
  defaultMoveIn,
  defaultDeposit,
  onConfirm,
  onCancel,
}: Props) {
  const fields = getOptionalsForType(documentType);
  const [payload, setPayload] = useState<OptionalPayload>({});
  const [deductionLines, setDeductionLines] = useState("");

  useEffect(() => {
    const p: OptionalPayload = {};
    if (defaultMoveIn) p.moveIn = defaultMoveIn;
    if (defaultDeposit != null) p.deposit = defaultDeposit;
    setPayload(p);
  }, [defaultMoveIn, defaultDeposit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: OptionalPayload = {};
    if (payload.moveIn != null) out.moveIn = payload.moveIn;
    if (payload.deposit != null) out.deposit = Number(payload.deposit);
    if (payload.dueDate != null) out.dueDate = payload.dueDate;
    if (payload.amountDue != null) out.amountDue = Number(payload.amountDue);
    if (payload.reason != null) out.reason = String(payload.reason).trim();
    if (payload.noticeBody != null) out.noticeBody = String(payload.noticeBody).trim();
    if (payload.entryDate != null) out.entryDate = payload.entryDate;
    if (payload.entryTime != null) out.entryTime = payload.entryTime;
    if (payload.depositAmount != null) out.depositAmount = Number(payload.depositAmount);
    if (payload.amountReturned != null) out.amountReturned = Number(payload.amountReturned);
    if (fields.includes("deductions") && deductionLines.trim()) {
      out.deductions = deductionLines
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(",").map((s) => s.trim());
          const amount = Number(parts[parts.length - 1]) || 0;
          const reason = parts.slice(0, -1).join(", ").trim() || "Deduction";
          return { reason, amount };
        });
    }
    onConfirm(out);
  };

  if (fields.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Document options</h3>
        <p className="mt-1 text-sm text-slate-600">Fill in any details below (optional where not required).</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {fields.includes("moveIn") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Move-in date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.moveIn as string) ?? defaultMoveIn ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, moveIn: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("deposit") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Security deposit ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                placeholder={defaultDeposit?.toString()}
                value={(payload.deposit as number) ?? defaultDeposit ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, deposit: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          {fields.includes("dueDate") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Due date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.dueDate as string) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, dueDate: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("amountDue") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount due ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.amountDue as number) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, amountDue: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          {fields.includes("reason") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Reason / description</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="e.g. Non-payment of rent for March 2025"
                value={(payload.reason as string) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("noticeBody") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Notice text</label>
              <textarea
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="Enter the notice content..."
                value={(payload.noticeBody as string) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, noticeBody: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("entryDate") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Entry date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.entryDate as string) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, entryDate: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("entryTime") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Entry time</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                placeholder="e.g. 10:00 AM – 12:00 PM"
                value={(payload.entryTime as string) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, entryTime: e.target.value }))}
              />
            </div>
          )}
          {fields.includes("depositAmount") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Deposit received ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.depositAmount as number) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, depositAmount: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          {fields.includes("amountReturned") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Amount returned to tenant ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm min-h-[48px]"
                value={(payload.amountReturned as number) ?? ""}
                onChange={(e) => setPayload((p) => ({ ...p, amountReturned: e.target.value ? Number(e.target.value) : undefined }))}
              />
            </div>
          )}
          {fields.includes("deductions") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Deductions (one per line: reason, amount)</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                placeholder="e.g. Repair wall damage, 150"
                value={deductionLines}
                onChange={(e) => setDeductionLines(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white"
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
