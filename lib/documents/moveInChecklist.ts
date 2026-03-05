import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";

export async function generateMoveInChecklist(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Move-in Inspection Checklist");

  const lines = [
    `Property: ${ctx.propertyAddress}`,
    `Tenant: ${ctx.tenantName}`,
    `Date: ${docDateFormatted(ctx)}`,
    "",
    "The following condition of the unit and fixtures is recorded at move-in. Tenant and landlord should review together and note any existing damage or issues.",
    "",
    "Rooms / Areas:",
    "[ ] Living room – walls, floors, windows",
    "[ ] Kitchen – appliances, cabinets, counters",
    "[ ] Bathroom(s) – fixtures, tiles, ventilation",
    "[ ] Bedroom(s) – walls, floors, closets",
    "[ ] Entry / hallways",
    "[ ] Exterior / parking (if applicable)",
    "",
    "Notes / existing damage:",
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
