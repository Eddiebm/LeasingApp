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
        <p>Application ID: <strong>${applicationId}</strong>. Keep this for your records.</p>
        <p><strong>Next steps:</strong></p>
        <ul>
          <li>Complete the screening payment (you'll be redirected after applying, or use the link in your application confirmation page).</li>
          <li>After payment, we'll run your background and credit check and the landlord will review your application.</li>
          <li>You can upload documents and check status in the Tenant Portal.</li>
        </ul>
        <p>We'll get back to you once the review is complete.</p>
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
