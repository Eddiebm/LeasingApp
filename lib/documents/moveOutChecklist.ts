import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";

export async function generateMoveOutChecklist(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Move-out Inspection Checklist");

  const lines = [
    `Property: ${ctx.propertyAddress}`,
    `Tenant: ${ctx.tenantName}`,
    `Date: ${docDateFormatted(ctx)}`,
    "",
    "Condition of the unit at move-out. Compare to move-in checklist when determining deposit disposition.",
    "",
    "[ ] All personal belongings removed",
    "[ ] Keys / access returned",
    "[ ] Living room",
    "[ ] Kitchen",
    "[ ] Bathroom(s)",
    "[ ] Bedroom(s)",
    "[ ] Floors / walls (clean, no damage)",
    "[ ] Utilities (per lease terms)",
    "",
    "Damage or cleaning issues beyond normal wear:",
    "_____________________________________________",
    "_____________________________________________",
    "",
    "Tenant signature: _________________________  Date: _________",
    "Landlord/Agent:   _________________________  Date: _________",
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
