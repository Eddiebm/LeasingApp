import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateRentalAgreementReminder(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Rental Agreement Reminder");

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "This letter is a reminder of key terms of your rental agreement. Please review and ensure compliance.",
    "",
    "Summary of terms:",
    `• Monthly rent: ${formatCurrency(ctx.rent)}`,
    `• Security deposit: ${formatCurrency(ctx.deposit)}`,
    `• Move-in date: ${ctx.moveInDate ? ctx.moveInDate : "Per lease"}`,
    "",
    "You are responsible for: timely rent payment, maintaining the premises, following community rules (if any), and giving proper notice before moving out as required by your lease and local law.",
    "",
    "If you have questions about your lease terms, please contact the landlord.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
