import { PDFDocument } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 18;
const BODY_SIZE = 11;
const BOTTOM_MARGIN = 60;
const MAX_CHARS_PER_LINE = 82;

/** Word-wrap text to fit width (approx). Returns array of lines. */
function wrapText(text: string, maxLen: number = MAX_CHARS_PER_LINE): string[] {
  const out: string[] = [];
  const words = text.split(/\s+/);
  let line = "";
  for (const w of words) {
    if (line.length + w.length + 1 <= maxLen) line += (line ? " " : "") + w;
    else {
      if (line) out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out;
}

/** Split body into lines (paragraphs first, then wrap each). */
function bodyToLines(body: string): string[] {
  const lines: string[] = [];
  const paragraphs = body.split(/\n\n+/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const wrapped = wrapText(trimmed.replace(/\n/g, " "));
    lines.push(...wrapped);
    lines.push(""); // paragraph gap
  }
  return lines;
}

export type LeasePdfOptions = {
  title: string;
  landlordName: string;
  tenantNames: string[];
  propertyAddress: string;
  bodyText: string;
  disclaimer: string;
};

export async function generateLeasePdf(options: LeasePdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const headerLines = [
    `Landlord: ${options.landlordName}`,
    `Tenant(s): ${options.tenantNames.join(", ")}`,
    `Property: ${options.propertyAddress}`,
  ];
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawLine = (text: string, size: number = BODY_SIZE) => {
    if (y < BOTTOM_MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(text, { x: MARGIN, y, size });
    y -= LINE_HEIGHT;
  };

  page.drawText(options.title, { x: MARGIN, y, size: TITLE_SIZE });
  y -= 24;
  for (const line of headerLines) {
    drawLine(line);
  }
  y -= LINE_HEIGHT;

  const bodyLines = bodyToLines(options.bodyText);
  for (const line of bodyLines) {
    if (line === "") y -= LINE_HEIGHT / 2;
    else drawLine(line);
  }

  y -= LINE_HEIGHT * 2;
  const disclaimerLines = bodyToLines(options.disclaimer);
  for (const line of disclaimerLines) {
    if (line === "") y -= LINE_HEIGHT / 2;
    else drawLine(line, 9);
  }

  y -= LINE_HEIGHT * 3;
  drawLine("Landlord signature: _________________________ Date: __________");
  drawLine("Tenant signature(s): _________________________ Date: __________");

  const bytes = await pdf.save();
  return bytes;
}

export type NoticePdfOptions = {
  title: string;
  bodyText: string;
  disclaimer: string;
};

export async function generateNoticePdf(options: NoticePdfOptions): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawLine = (text: string, size: number = BODY_SIZE) => {
    if (y < BOTTOM_MARGIN) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(text, { x: MARGIN, y, size });
    y -= LINE_HEIGHT;
  };

  page.drawText(options.title, { x: MARGIN, y, size: TITLE_SIZE });
  y -= 24;

  const bodyLines = bodyToLines(options.bodyText);
  for (const line of bodyLines) {
    if (line === "") y -= LINE_HEIGHT / 2;
    else drawLine(line);
  }

  y -= LINE_HEIGHT * 2;
  const disclaimerLines = bodyToLines(options.disclaimer);
  for (const line of disclaimerLines) {
    if (line === "") y -= LINE_HEIGHT / 2;
    else drawLine(line, 9);
  }

  const bytes = await pdf.save();
  return bytes;
}
