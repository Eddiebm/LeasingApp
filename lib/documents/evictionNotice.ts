import { DocumentContext } from "./context";
import { addPage, createPdf, drawLines, drawTitle, docDateFormatted, wrapText } from "./pdfHelpers";
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

export async function generateEvictionNotice(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  const title = ctx.stateCode ? `Eviction Notice — ${ctx.stateCode}` : "Eviction Notice";
  let y = drawTitle(page, title);

  const header = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
  ];

  const useAi = ctx.useAi === true && !!ctx.stateCode;
  const aiBody = useAi ? await generateAiDocumentBody("eviction_notice", ctx) : null;

  const reason = ctx.reason ?? "Termination of tenancy as permitted by lease and applicable law.";

  const lines = aiBody
    ? [...header, ...bodyToLines(aiBody), "", AI_DISCLAIMER, "", `— ${ctx.landlordName}`]
    : [
        ...header,
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
