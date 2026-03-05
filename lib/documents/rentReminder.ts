import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateRentReminder(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Rent Reminder");

  const due = ctx.dueDate ? docDateFormatted({ date: ctx.dueDate }) : "the date specified in your lease";
  const amount = ctx.amountDue ?? ctx.rent ?? 0;

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "This is a friendly reminder that rent is due. Please ensure payment is received by the due date to avoid late fees.",
    "",
    `Amount due: ${formatCurrency(amount)}`,
    `Due date: ${due}`,
    "",
    "If you have already paid, please disregard this notice. Thank you.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
