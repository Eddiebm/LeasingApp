import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted } from "./pdfHelpers";
import { formatCurrency } from "./context";

export async function generateLease(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  let y = drawTitle(page, "Residential Lease Agreement");

  const lines = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Landlord: ${ctx.landlordName}`,
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    `Rent: ${formatCurrency(ctx.rent)} per month`,
    `Security Deposit: ${formatCurrency(ctx.deposit)}`,
    `Move-in Date: ${ctx.moveInDate ? docDateFormatted({ date: ctx.moveInDate }) : "See addendum"}`,
    "",
    "This agreement constitutes a residential lease between the parties listed above. The tenant agrees to pay rent on time, maintain the premises, and comply with all terms communicated by the landlord. The landlord agrees to maintain the property in habitable condition and respect the tenant's right to quiet enjoyment.",
    "",
    "Additional terms and conditions may be provided in a separate addendum or in the lease packet provided to the tenant.",
  ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
