import { PDFDocument, PDFPage } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 18;
const BODY_SIZE = 11;

export function createPdf(): PDFDocument {
  return PDFDocument.create();
}

export function addPage(pdf: PDFDocument): PDFPage {
  return pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

export function getPageSize(): { width: number; height: number } {
  return { width: PAGE_WIDTH, height: PAGE_HEIGHT };
}

/** Draw title at top of page. Returns y position below title. */
export function drawTitle(page: PDFPage, title: string): number {
  const y = PAGE_HEIGHT - MARGIN - TITLE_SIZE;
  page.drawText(title, { x: MARGIN, y, size: TITLE_SIZE });
  return y - 24;
}

/** Draw a single line of body text. Returns next y. */
export function drawLine(page: PDFPage, text: string, y: number, size: number = BODY_SIZE): number {
  page.drawText(text, { x: MARGIN, y, size });
  return y - LINE_HEIGHT;
}

/** Draw multiple lines from top to bottom. Returns final y. */
export function drawLines(page: PDFPage, lines: string[], startY: number): number {
  let y = startY;
  for (const line of lines) {
    if (line.trim()) y = drawLine(page, line, y);
    else y -= LINE_HEIGHT / 2;
  }
  return y;
}

/** Simple word-wrap so long text doesn't overflow (approx 80 chars per line). */
export function wrapText(text: string, maxLen: number = 80): string[] {
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

export function docDate(ctx: { date?: string }): string {
  if (ctx.date) return ctx.date;
  return new Date().toISOString().slice(0, 10);
}

export function docDateFormatted(ctx: { date?: string }): string {
  const d = docDate(ctx);
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return d;
  }
}
