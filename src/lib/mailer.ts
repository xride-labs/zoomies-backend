import nodemailer from "nodemailer";

export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_APP_PASSWORD;
const emailFrom = process.env.EMAIL_FROM || emailUser;

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!emailUser || !emailPass) {
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });

  return cachedTransporter;
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transporter = getTransporter();

  if (!transporter || !emailFrom) {
    console.warn(
      "[Email] Skipped sending email: EMAIL_USER/EMAIL_APP_PASSWORD not configured",
    );
    return false;
  }

  await transporter.sendMail({
    from: emailFrom,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    replyTo: payload.replyTo,
  });

  return true;
}

export async function sendVerificationEmail(params: {
  to: string;
  name?: string | null;
  token: string;
}): Promise<boolean> {
  const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const encodedEmail = encodeURIComponent(params.to);
  const verifyUrl = `${appUrl}/verify-email?token=${params.token}&email=${encodedEmail}`;
  const greeting = params.name ? `Hi ${params.name},` : "Hi there,";

  return sendEmail({
    to: params.to,
    subject: "Verify your Zoomies account",
    text: `${greeting}\n\nVerify your email: ${verifyUrl}\n\nIf you did not sign up, you can ignore this email.`,
    html: `<p>${greeting}</p><p>Verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>If you did not sign up, you can ignore this email.</p>`,
  });
}

export async function sendRideJoinRequestEmail(params: {
  to: string;
  rideTitle: string;
  requesterName: string;
  message?: string;
}): Promise<boolean> {
  const messageLine = params.message ? `<p>Message: ${params.message}</p>` : "";

  return sendEmail({
    to: params.to,
    subject: `New join request for ${params.rideTitle}`,
    text: `${params.requesterName} requested to join your ride: ${params.rideTitle}${params.message ? `\nMessage: ${params.message}` : ""}`,
    html: `<p>${params.requesterName} requested to join your ride: <strong>${params.rideTitle}</strong></p>${messageLine}`,
  });
}

export async function sendClubJoinEmail(params: {
  to: string;
  clubName: string;
  memberName: string;
}): Promise<boolean> {
  return sendEmail({
    to: params.to,
    subject: `New member joined ${params.clubName}`,
    text: `${params.memberName} joined your club: ${params.clubName}.`,
    html: `<p>${params.memberName} joined your club: <strong>${params.clubName}</strong>.</p>`,
  });
}

export async function sendAlertEmail(params: {
  to: string;
  subject: string;
  message: string;
}): Promise<boolean> {
  return sendEmail({
    to: params.to,
    subject: params.subject,
    text: params.message,
    html: `<p>${params.message}</p>`,
  });
}
