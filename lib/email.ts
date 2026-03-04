import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM ?? "Bannerman Leasing <onboarding@resend.dev>";

export async function sendApplicationReceived(to: string, applicationId: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Application received – Bannerman Leasing",
      html: `
        <p>We've received your rental application.</p>
        <p>Application ID: <strong>${applicationId}</strong></p>
        <p>We'll review it and get back to you soon. You can check status in the Tenant Portal.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendMaintenanceReceived(to: string, requestId: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Maintenance request received – Bannerman Leasing",
      html: `
        <p>We've received your maintenance request.</p>
        <p>Request ID: <strong>${requestId}</strong></p>
        <p>We'll update you on progress. You can also check status in the Tenant Portal.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}
