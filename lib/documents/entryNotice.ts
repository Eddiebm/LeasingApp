import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";

export async function generateEntryNotice(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Notice of Entry (24-Hour)");

  const entryDate = ctx.entryDate ? docDateFormatted({ date: ctx.entryDate }) : "[Date]";
  const entryTime = ctx.entryTime ?? "[Time]";
  const reason = ctx.reason ?? "Inspection / maintenance";

  const lines = [
    `Date of notice: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "This is official notice that the landlord or authorized agent will enter the premises as permitted by law (typically with at least 24 hours' notice).",
    "",
    `Scheduled entry date: ${entryDate}`,
    `Approximate time: ${entryTime}`,
    `Purpose: ${reason}`,
    "",
    "If you need to reschedule, please contact the landlord as soon as possible.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
