import { PDFDocument } from "pdf-lib";

type LeaseData = {
  tenant: string;
  property: string;
  rent: number;
  deposit: number;
  moveIn: string;
  landlord: string;
};

export async function generateLease(data: LeaseData) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]); // Letter size

  const { height } = page.getSize();
  const marginTop = height - 80;

  page.drawText(`Residential Lease Agreement`, {
    x: 50,
    y: marginTop,
    size: 18
  });

  const lines = [
    `Landlord: ${data.landlord}`,
    `Tenant: ${data.tenant}`,
    `Property: ${data.property}`,
    `Rent: $${data.rent}`,
    `Deposit: $${data.deposit}`,
    `Move-in Date: ${data.moveIn}`
  ];

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: 50,
      y: marginTop - 40 - index * 18,
      size: 12
    });
  });

  const bytes = await pdf.save();
  return bytes;
}

