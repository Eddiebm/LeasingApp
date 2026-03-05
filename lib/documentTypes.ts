/**
 * Rental lifecycle document types: cradle (application/lease) → in-tenancy (reminders, notices) → exit (move-out, eviction).
 * Used for API, DB document.type, and dashboard UI labels.
 */
export const DOCUMENT_TYPES = [
  // Cradle / start
  { id: "lease", label: "Lease / Rental Agreement", group: "cradle" },
  { id: "loi", label: "Letter of Intent (LOI)", group: "cradle" },
  { id: "move_in_checklist", label: "Move-in Checklist / Inspection", group: "cradle" },
  // During tenancy
  { id: "rent_reminder", label: "Rent Reminder Letter", group: "during" },
  { id: "late_rent_notice", label: "Late Rent Notice", group: "during" },
  { id: "rent_receipt", label: "Rent Receipt", group: "during" },
  { id: "rental_agreement_reminder", label: "Rental Agreement Reminder", group: "during" },
  { id: "notice_of_violation", label: "Notice of Violation (Cure or Quit)", group: "during" },
  { id: "entry_notice", label: "Entry Notice (24-Hour)", group: "during" },
  { id: "notice", label: "General Notice", group: "during" },
  // Exit / eviction
  { id: "pay_or_quit", label: "Pay or Quit Notice", group: "exit" },
  { id: "eviction_notice", label: "Eviction Notice", group: "exit" },
  { id: "move_out_checklist", label: "Move-out Checklist / Inspection", group: "exit" },
  { id: "security_deposit_disposition", label: "Security Deposit Disposition", group: "exit" },
] as const;

export type DocumentTypeId = (typeof DOCUMENT_TYPES)[number]["id"];

export const DOCUMENT_TYPE_IDS: DocumentTypeId[] = DOCUMENT_TYPES.map((d) => d.id);

export function getDocumentTypeLabel(id: string): string {
  return DOCUMENT_TYPES.find((d) => d.id === id)?.label ?? id;
}

export const DOCUMENT_GROUPS = [
  { id: "cradle", label: "Application & move-in" },
  { id: "during", label: "During tenancy" },
  { id: "exit", label: "Move-out & eviction" },
] as const;
