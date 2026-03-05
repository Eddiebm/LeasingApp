import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";

export async function generateNoticeOfViolation(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Notice of Violation (Cure or Quit)");

  const reason = ctx.reason ?? "Violation of lease terms";
  const cureDays = "As required by applicable law (typically 3–10 days).";

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "You are hereby notified that the following violation(s) of your lease or rental agreement have been observed:",
    "",
    reason,
    "",
    "You must cure (fix) this violation within the time required by law. If you do not cure the violation within that period, the landlord may proceed with termination of your tenancy and/or eviction.",
    "",
    "Cure period: " + cureDays,
    "",
    "This notice is sent in accordance with applicable landlord-tenant law. You may have rights to contest this notice; consult local laws or an attorney.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
