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

export async function generatePayOrQuit(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  const title = ctx.stateCode ? `Pay Rent or Quit Notice — ${ctx.stateCode}` : "Pay Rent or Quit Notice";
  let y = drawTitle(page, title);

  const header = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
  ];

  const useAi = ctx.useAi === true && !!ctx.stateCode;
  const aiBody = useAi ? await generateAiDocumentBody("pay_or_quit", ctx) : null;

  const amount = ctx.amountDue ?? ctx.rent ?? 0;
  const days = "As required by applicable law (often 3–5 days).";

  const lines = aiBody
    ? [...header, ...bodyToLines(aiBody), "", AI_DISCLAIMER, "", `— ${ctx.landlordName}`]
    : [
        ...header,
        "You are in default under your lease for non-payment of rent. You must do one of the following:",
        "",
        `1. Pay the full amount owed: ${formatCurrency(amount)} (and any late fees per your lease), within ${days}`,
        "",
        "OR",
        "",
        "2. Vacate the premises and deliver possession to the landlord within the same period.",
        "",
        "If you do neither, the landlord may file an unlawful detainer (eviction) action. You may be responsible for court costs and attorney fees as allowed by law.",
        "",
        "This notice is sent pursuant to applicable landlord-tenant law. Consult local laws or an attorney regarding your rights.",
        "",
        `— ${ctx.landlordName}`,
      ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
