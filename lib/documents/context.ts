/**
 * Shared context passed to all document generators.
 * API builds this from application + tenant + property + landlord (+ optional payload).
 */
export type DocumentContext = {
  tenantName: string;
  tenantEmail?: string;
  propertyAddress: string;
  rent?: number;
  deposit?: number;
  landlordName: string;
  moveInDate?: string;
  // Optional payload for notices / reminders
  dueDate?: string;
  amountDue?: number;
  reason?: string;
  noticeBody?: string;
  entryDate?: string;
  entryTime?: string;
  /** For disposition: amount withheld, reason, etc. */
  depositAmount?: number;
  amountReturned?: number;
  deductions?: { reason: string; amount: number }[];
  /** Document date (default today) */
  date?: string;
  /** State code (e.g. "CA", "TX") for state-specific / AI-generated legal language */
  stateCode?: string;
  /** If true and stateCode + API key set, use AI to generate state-specific document body */
  useAi?: boolean;
};

export function formatDate(s: string | undefined): string {
  if (!s) return "";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return s;
  }
}

export function formatCurrency(n: number | undefined): string {
  if (n == null || Number.isNaN(n)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
