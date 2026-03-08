import { Resend } from "resend";

type EmailOptions = { resendApiKey?: string; from?: string };

function getResend(opts?: EmailOptions): Resend | null {
  const key = opts?.resendApiKey ?? process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

function getFrom(opts?: EmailOptions): string {
  return opts?.from ?? process.env.EMAIL_FROM ?? "RentLease <onboarding@resend.dev>";
}

export async function sendNewApplicationEmail(
  landlordEmail: string,
  tenantName: string,
  propertyAddress: string,
  applicationId: string,
  dashboardLink: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [landlordEmail],
      subject: `New application from ${tenantName} — ${propertyAddress}`,
      html: `
        <p>A new application has been submitted.</p>
        <p><strong>Tenant:</strong> ${tenantName}</p>
        <p><strong>Property:</strong> ${propertyAddress}</p>
        <p><a href="${dashboardLink}">View in dashboard</a> to review.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendApplicationStatusEmail(
  tenantEmail: string,
  tenantName: string,
  status: string,
  propertyAddress: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Your application for ${propertyAddress} has been ${status}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Your application for <strong>${propertyAddress}</strong> has been <strong>${status}</strong>.</p>
        <p>Next steps will be sent in a follow-up email, or you can check your tenant portal for updates.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendPaymentConfirmationEmail(
  tenantEmail: string,
  tenantName: string,
  amountCents: number,
  currency: string,
  propertyAddress: string,
  paidAt: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  const amount = (amountCents / 100).toFixed(2);
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Payment confirmed — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Your payment of <strong>${currency} ${amount}</strong> for ${propertyAddress} has been confirmed.</p>
        <p>Date: ${new Date(paidAt).toLocaleDateString()}</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendMaintenanceAcknowledgementEmail(
  tenantEmail: string,
  tenantName: string,
  title: string,
  urgency: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `We received your maintenance request: ${title}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>We've received your maintenance request: <strong>${title}</strong> (${urgency} priority).</p>
        <p>Your landlord will be in touch within 24–48 hours.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendLeaseForSigningEmail(
  tenantEmail: string,
  tenantName: string,
  propertyAddress: string,
  signingUrl: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Please sign your lease — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Your landlord has sent you a lease to sign.</p>
        <p>Click the link below to review and sign:</p>
        <p><a href="${signingUrl}">${signingUrl}</a></p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendSignedLeaseEmail(
  recipientEmail: string,
  recipientName: string,
  propertyAddress: string,
  signedPdfUrl: string,
  tenantName: string,
  signedAt: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  const dateStr = new Date(signedAt).toLocaleDateString();
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [recipientEmail],
      subject: `Signed lease — ${propertyAddress}`,
      html: `
        <p>Hi ${recipientName},</p>
        <p>The lease for <strong>${propertyAddress}</strong> has been signed by ${tenantName} on ${dateStr}.</p>
        <p><a href="${signedPdfUrl}">Download signed lease (PDF)</a></p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendRentPaymentRequestEmail(
  tenantEmail: string,
  tenantName: string,
  amountFormatted: string,
  period: string,
  propertyAddress: string,
  paymentUrl: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Rent payment due — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Rent payment is due for <strong>${propertyAddress}</strong>.</p>
        <p><strong>Period:</strong> ${period}</p>
        <p><strong>Amount:</strong> ${amountFormatted}</p>
        <p><a href="${paymentUrl}">Pay now</a></p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendRentReceiptEmail(
  tenantEmail: string,
  tenantName: string,
  amountFormatted: string,
  period: string,
  propertyAddress: string,
  paidAt: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  const dateStr = new Date(paidAt).toLocaleDateString();
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Payment received — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Your rent payment of <strong>${amountFormatted}</strong> for ${period} — ${propertyAddress} has been received.</p>
        <p>Date: ${dateStr}</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendRentPaidNotificationEmail(
  landlordEmail: string,
  tenantName: string,
  amountFormatted: string,
  period: string,
  propertyAddress: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [landlordEmail],
      subject: `Rent paid — ${tenantName} — ${propertyAddress}`,
      html: `
        <p>Rent payment received from <strong>${tenantName}</strong> for <strong>${propertyAddress}</strong>.</p>
        <p><strong>Amount:</strong> ${amountFormatted}</p>
        <p><strong>Period:</strong> ${period}</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendLatePaymentReminderEmail(
  tenantEmail: string,
  tenantName: string,
  amountFormatted: string,
  lateFeeFormatted: string,
  dueDate: string,
  propertyAddress: string,
  paymentUrl: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Late payment reminder — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Your rent payment for <strong>${propertyAddress}</strong> is past due.</p>
        <p><strong>Amount due:</strong> ${amountFormatted}</p>
        <p><strong>Late fee:</strong> ${lateFeeFormatted}</p>
        <p><strong>Due date was:</strong> ${dueDate}</p>
        <p><a href="${paymentUrl}">Pay now</a></p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendLatePaymentLandlordAlertEmail(
  landlordEmail: string,
  tenantName: string,
  amountFormatted: string,
  daysLate: number,
  propertyAddress: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [landlordEmail],
      subject: `Late payment — ${tenantName} — ${propertyAddress}`,
      html: `
        <p>Rent payment from <strong>${tenantName}</strong> for <strong>${propertyAddress}</strong> is ${daysLate} day(s) late.</p>
        <p><strong>Amount due:</strong> ${amountFormatted}</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendAutopayConfirmationEmail(
  tenantEmail: string,
  tenantName: string,
  amountFormatted: string,
  dueDay: number,
  propertyAddress: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [tenantEmail],
      subject: `Autopay set up — ${propertyAddress}`,
      html: `
        <p>Hi ${tenantName},</p>
        <p>Autopay has been set up for your rent at <strong>${propertyAddress}</strong>.</p>
        <p><strong>Amount:</strong> ${amountFormatted} (charged on the ${dueDay}${dueDay === 1 ? "st" : dueDay === 2 ? "nd" : dueDay === 3 ? "rd" : "th"} of each month)</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

export async function sendConnectOnboardingCompleteEmail(
  landlordEmail: string,
  landlordName: string,
  opts?: EmailOptions
): Promise<boolean> {
  const resend = getResend(opts);
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from: getFrom(opts),
      to: [landlordEmail],
      subject: "Bank account connected — RentLease",
      html: `
        <p>Hi ${landlordName},</p>
        <p>Your bank account is now connected. You can start collecting rent through RentLease.</p>
      `
    });
    return !error;
  } catch {
    return false;
  }
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const from = process.env.EMAIL_FROM ?? "RentLease <onboarding@resend.dev>";

export async function sendApplicationReceived(to: string, applicationId: string): Promise<boolean> {
  if (!resend) return false;
  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: "Application received – RentLease",
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
      subject: "Maintenance request received – RentLease",
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
