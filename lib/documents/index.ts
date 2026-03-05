import type { DocumentContext } from "./context";
import type { DocumentTypeId } from "../documentTypes";
import { generateLease } from "./lease";
import { generateLOI } from "./loi";
import { generateMoveInChecklist } from "./moveInChecklist";
import { generateMoveOutChecklist } from "./moveOutChecklist";
import { generateRentReminder } from "./rentReminder";
import { generateLateRentNotice } from "./lateRentNotice";
import { generateRentReceipt } from "./rentReceipt";
import { generateRentalAgreementReminder } from "./rentalAgreementReminder";
import { generateNoticeOfViolation } from "./noticeOfViolation";
import { generateEntryNotice } from "./entryNotice";
import { generateNotice } from "./notice";
import { generatePayOrQuit } from "./payOrQuit";
import { generateEvictionNotice } from "./evictionNotice";
import { generateSecurityDepositDisposition } from "./securityDepositDisposition";

type Generator = (ctx: DocumentContext) => Promise<Uint8Array>;

const generators: Record<DocumentTypeId, Generator> = {
  lease: generateLease,
  loi: generateLOI,
  move_in_checklist: generateMoveInChecklist,
  move_out_checklist: generateMoveOutChecklist,
  rent_reminder: generateRentReminder,
  late_rent_notice: generateLateRentNotice,
  rent_receipt: generateRentReceipt,
  rental_agreement_reminder: generateRentalAgreementReminder,
  notice_of_violation: generateNoticeOfViolation,
  entry_notice: generateEntryNotice,
  notice: generateNotice,
  pay_or_quit: generatePayOrQuit,
  eviction_notice: generateEvictionNotice,
  security_deposit_disposition: generateSecurityDepositDisposition,
};

export function getGenerator(type: string): Generator | null {
  return type in generators ? (generators as Record<string, Generator>)[type] : null;
}

export async function generateDocument(type: DocumentTypeId, ctx: DocumentContext): Promise<Uint8Array> {
  const gen = getGenerator(type);
  if (!gen) throw new Error(`Unknown document type: ${type}`);
  return gen(ctx);
}

export function getFilename(type: DocumentTypeId, applicationId: string): string {
  const slug = type.replace(/_/g, "-");
  return `${slug}-${applicationId}-${Date.now()}.pdf`;
}
