import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted, wrapText } from "./pdfHelpers";
import { formatCurrency } from "./context";
import { generateAiDocumentBody, AI_DISCLAIMER } from "./aiGenerate";

function bodyToLines(body: string): string[] {
  const paragraphs = body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const lines: string[] = [];
  for (const p of paragraphs) {
    lines.push(...wrapText(p));
    lines.push("");
  }
  return lines;
}

export async function generateLease(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  const title = ctx.stateCode ? `Residential Lease Agreement — ${ctx.stateCode}` : "Residential Lease Agreement";
  let y = drawTitle(page, title);

  const header = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Landlord: ${ctx.landlordName}`,
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    `Rent: ${formatCurrency(ctx.rent)} per month`,
    `Security Deposit: ${formatCurrency(ctx.deposit)}`,
    `Move-in Date: ${ctx.moveInDate ? docDateFormatted({ date: ctx.moveInDate }) : "See addendum"}`,
    "",
  ];

  const useAi = ctx.useAi === true && !!ctx.stateCode;
  const aiBody = useAi ? await generateAiDocumentBody("lease", ctx) : null;

  const lines = aiBody
    ? [...header, ...bodyToLines(aiBody), "", AI_DISCLAIMER, "", `— ${ctx.landlordName}`]
    : [
        ...header,
        "This agreement constitutes a residential lease between the parties listed above. The tenant agrees to pay rent on time, maintain the premises, and comply with all terms communicated by the landlord. The landlord agrees to maintain the property in habitable condition and respect the tenant's right to quiet enjoyment.",
        "",
        "Additional terms and conditions may be provided in a separate addendum or in the lease packet provided to the tenant.",
      ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
