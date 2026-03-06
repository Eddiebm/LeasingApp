import { PDFDocument } from "pdf-lib";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const FONT_SIZE = 11;

export type SignatureBlockParams = {
  propertyAddress: string;
  signedByName: string;
  signedAtIso: string;
  ipAddress: string;
  documentHash: string | null;
};

/**
 * Appends a signature record page to the end of the lease PDF (ESIGN-compliant block).
 */
export async function generateSignedPdf(
  originalPdfBytes: Uint8Array,
  params: SignatureBlockParams
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { height } = page.getSize();

  const dateStr = new Date(params.signedAtIso).toISOString().slice(0, 10);
  const lines = [
    "─────────────────────────────────────────────────",
    "ELECTRONIC SIGNATURE RECORD",
    "",
    `Document: Lease Agreement — ${params.propertyAddress}`,
    `Signed by: ${params.signedByName}`,
    `Date: ${dateStr}`,
    `IP Address: ${params.ipAddress}`,
    `Document SHA-256: ${params.documentHash ?? "—"}`,
    "",
    "This document was signed electronically under the",
    "Electronic Signatures in Global and National",
    "Commerce Act (ESIGN, 2000) and is legally binding.",
    "─────────────────────────────────────────────────"
  ];

  let y = height - MARGIN;
  for (const line of lines) {
    page.drawText(line, { x: MARGIN, y, size: line.startsWith("─") ? 9 : FONT_SIZE });
    y -= LINE_HEIGHT;
  }

  const bytes = await pdfDoc.save();
  return bytes;
}
