import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateLateRentNotice(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Late Rent Notice");

  const amount = ctx.amountDue ?? ctx.rent ?? 0;
  const due = ctx.dueDate ? docDateFormatted({ date: ctx.dueDate }) : "the due date under your lease";

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "Your rent payment was not received by the due date. This notice serves as a formal record of the delinquency.",
    "",
    `Amount past due: ${formatCurrency(amount)}`,
    `Original due date: ${due}`,
    "",
    "Please remit payment as soon as possible. Late fees may apply as specified in your lease. Continued non-payment may result in further action, including a Pay or Quit notice and eviction proceedings.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
