import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateLOI(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Letter of Intent to Rent");

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `From: ${ctx.landlordName}`,
    `To: ${ctx.tenantName}`,
    "",
    "This letter confirms the intent to enter into a residential lease agreement under the following terms:",
    "",
    `Property: ${ctx.propertyAddress}`,
    `Monthly Rent: ${formatCurrency(ctx.rent)}`,
    `Security Deposit: ${formatCurrency(ctx.deposit)}`,
    `Anticipated Move-in: ${ctx.moveInDate ? docDateFormatted({ date: ctx.moveInDate }) : "To be determined"}`,
    "",
    "This letter is not a lease. A formal lease agreement will be provided for signature prior to occupancy. This LOI may be subject to approval of application, screening, and any conditions set by the landlord.",
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
