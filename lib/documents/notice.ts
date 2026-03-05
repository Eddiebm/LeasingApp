import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted, wrapText } from "./pdfHelpers";

export async function generateNotice(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "General Notice");

  const body = ctx.noticeBody ?? "This notice is provided for your information. Please contact the landlord with any questions.";

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `To: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    ...wrapText(body, 75),
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
