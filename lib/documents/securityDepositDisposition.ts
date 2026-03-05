import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateSecurityDepositDisposition(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Security Deposit Disposition");

  const deposit = ctx.depositAmount ?? ctx.deposit ?? 0;
  const returned = ctx.amountReturned ?? 0;
  const deductions = ctx.deductions ?? [];

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "Security deposit received: " + formatCurrency(deposit),
    "",
    ...(deductions.length > 0
      ? ["Deductions:", ...deductions.map((d) => `  • ${d.reason}: ${formatCurrency(d.amount)}`), ""]
      : []),
    "Amount returned to tenant: " + formatCurrency(returned),
    "",
    "This disposition is provided as required by applicable law. Deductions are for damages beyond normal wear and tear, unpaid rent, or other amounts permitted under the lease and law. If you have questions or dispute any deduction, please contact the landlord in writing.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
