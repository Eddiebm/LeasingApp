/**
 * Which document types need optional payload fields in the UI.
 * Keys match DocumentTypeId; value describes the form fields.
 */
export type OptionalField =
  | "dueDate"
  | "amountDue"
  | "reason"
  | "noticeBody"
  | "entryDate"
  | "entryTime"
  | "moveIn"
  | "deposit"
  | "depositAmount"
  | "amountReturned"
  | "deductions"
  | "stateCode"
  | "useAi";

export const DOCUMENT_OPTIONALS: Partial<
  Record<string, { label: string; fields: OptionalField[] }>
> = {
  lease: { label: "Lease", fields: ["moveIn", "deposit", "stateCode", "useAi"] },
  rent_reminder: { label: "Rent Reminder", fields: ["dueDate", "amountDue"] },
  late_rent_notice: { label: "Late Rent Notice", fields: ["dueDate", "amountDue"] },
  rent_receipt: { label: "Rent Receipt", fields: ["amountDue", "dueDate"] },
  notice_of_violation: { label: "Notice of Violation", fields: ["reason", "stateCode", "useAi"] },
  entry_notice: { label: "Entry Notice", fields: ["entryDate", "entryTime", "reason"] },
  notice: { label: "General Notice", fields: ["noticeBody"] },
  pay_or_quit: { label: "Pay or Quit", fields: ["amountDue", "stateCode", "useAi"] },
  eviction_notice: { label: "Eviction Notice", fields: ["reason", "stateCode", "useAi"] },
  security_deposit_disposition: {
    label: "Security Deposit Disposition",
    fields: ["depositAmount", "amountReturned", "deductions"],
  },
};

export function getOptionalsForType(type: string): OptionalField[] {
  return DOCUMENT_OPTIONALS[type]?.fields ?? [];
}

export function hasOptionals(type: string): boolean {
  return getOptionalsForType(type).length > 0;
}
