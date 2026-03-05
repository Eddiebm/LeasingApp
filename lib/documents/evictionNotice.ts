import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";

export async function generateEvictionNotice(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Eviction Notice");

  const reason = ctx.reason ?? "Termination of tenancy as permitted by lease and applicable law.";

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
    "You are hereby notified that the landlord is terminating your tenancy. You must vacate the premises by the date required under applicable law.",
    "",
    "Reason / basis:",
    reason,
    "",
    "This notice does not replace any prior Pay or Quit or Cure or Quit notice that may have been sent. The landlord may pursue an unlawful detainer (eviction) action in court if you do not vacate. You may have legal rights; consult an attorney or local tenant resources.",
    "",
    `— ${ctx.landlordName}`,
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
