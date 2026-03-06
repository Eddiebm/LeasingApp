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

export async function generateNoticeOfViolation(ctx: DocumentContext): Promise<Uint8Array> {
  const pdf = createPdf();
  const page = addPage(pdf);
  const title = ctx.stateCode
    ? `Notice of Violation (Cure or Quit) — ${ctx.stateCode}`
    : "Notice of Violation (Cure or Quit)";
  let y = drawTitle(page, title);

  const header = [
    `Date: ${docDateFormatted(ctx)}`,
    "",
    `Tenant: ${ctx.tenantName}`,
    `Property: ${ctx.propertyAddress}`,
    "",
  ];

  const useAi = ctx.useAi === true && !!ctx.stateCode;
  const aiBody = useAi ? await generateAiDocumentBody("notice_of_violation", ctx) : null;

  const reason = ctx.reason ?? "Violation of lease terms";
  const cureDays = "As required by applicable law (typically 3–10 days).";

  const lines = aiBody
    ? [...header, ...bodyToLines(aiBody), "", AI_DISCLAIMER, "", `— ${ctx.landlordName}`]
    : [
        ...header,
        "You are hereby notified that the following violation(s) of your lease or rental agreement have been observed:",
        "",
        reason,
        "",
        "You must cure (fix) this violation within the time required by law. If you do not cure the violation within that period, the landlord may proceed with termination of your tenancy and/or eviction.",
        "",
        "Cure period: " + cureDays,
        "",
        "This notice is sent in accordance with applicable landlord-tenant law. You may have rights to contest this notice; consult local laws or an attorney.",
        "",
        `— ${ctx.landlordName}`,
      ];

  drawLines(page, lines, y);
  const bytes = await pdf.save();
  return bytes;
}
