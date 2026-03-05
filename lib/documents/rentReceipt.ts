import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateRentReceipt(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Rent Receipt");

  const amount = ctx.amountDue ?? ctx.rent ?? 0;

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    "Received from:",
    ctx.tenantName,
    "",
    "Property: " + ctx.propertyAddress,
    "Amount received: " + formatCurrency(amount),
    "For: Rent" + (ctx.dueDate ? ` (period including ${docDateFormatted({ date: ctx.dueDate })})` : ""),
    "",
    "This receipt confirms payment. Retain for your records.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
