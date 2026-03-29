export type EmailPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
};

const brevoApiUrl = "https://api.brevo.com/v3/smtp/email";
const brevoApiKey = process.env.BREVO_API_KEY || "EqJm9XzZpDFS0aj8";
const senderEmail = process.env.BREVO_SENDER_EMAIL || "noreply@xride-labs.in";
const senderName = process.env.BREVO_SENDER_NAME || "Zoomies";
const fallbackReplyTo = process.env.BREVO_REPLY_TO || "support@xride-labs.in";

function isBrevoConfigured(): boolean {
  return Boolean(brevoApiKey && senderEmail);
}

function normalizeName(name?: string | null): string | undefined {
  if (!name) {
    return undefined;
  }
  const trimmed = name.trim();
  return trimmed.length ? trimmed : undefined;
}

function getFirstName(name?: string | null): string | undefined {
  const normalized = normalizeName(name);
  if (!normalized) {
    return undefined;
  }
  return normalized.split(/\s+/)[0];
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (!isBrevoConfigured() || !senderEmail || !brevoApiKey) {
    console.warn(
      "[Email] Skipped sending email: BREVO_API_KEY/BREVO_SENDER_EMAIL not configured",
    );
    return false;
  }

  const response = await fetch(brevoApiUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "api-key": brevoApiKey,
    },
    body: JSON.stringify({
      sender: {
        email: senderEmail,
        name: senderName,
      },
      to: [{ email: payload.to }],
      subject: payload.subject,
      htmlContent: payload.html,
      textContent: payload.text,
      replyTo: payload.replyTo
        ? { email: payload.replyTo }
        : fallbackReplyTo
          ? { email: fallbackReplyTo }
          : undefined,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `[Email] Brevo send failed (${response.status}): ${errorText}`,
    );
    return false;
  }

  return true;
}

export async function sendVerificationEmail(params: {
  to: string;
  name?: string | null;
  token?: string;
  verifyUrl?: string;
}): Promise<boolean> {
  const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const encodedEmail = encodeURIComponent(params.to);
  const verifyUrl =
    params.verifyUrl ||
    (params.token
      ? `${appUrl}/verify-email?token=${params.token}&email=${encodedEmail}`
      : `${appUrl}/verify-email?email=${encodedEmail}`);
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

export async function sendResetPasswordEmail(params: {
  to: string;
  name?: string | null;
  resetUrl: string;
}): Promise<boolean> {
  const greeting = params.name ? `Hi ${params.name},` : "Hi there,";

  return sendEmail({
    to: params.to,
    subject: "Reset your Zoomies password",
    text: `${greeting}\n\nUse this link to reset your password: ${params.resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>${greeting}</p><p>Use this link to reset your password:</p><p><a href="${params.resetUrl}">${params.resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export async function sendOtpEmail(params: {
  to: string;
  otp: string;
  name?: string | null;
}): Promise<boolean> {
  const recipient = getFirstName(params.name);
  const greeting = recipient ? `Hi ${recipient},` : "Hi there,";

  return sendEmail({
    to: params.to,
    subject: "Your Zoomies OTP code",
    text: `${greeting}\n\nYour Zoomies verification code is: ${params.otp}\nThis code expires in 10 minutes.`,
    html: `<p>${greeting}</p><p>Your Zoomies verification code is:</p><p style="font-size: 24px; font-weight: 700; letter-spacing: 2px;">${params.otp}</p><p>This code expires in 10 minutes.</p>`,
  });
}

export async function sendWelcomeEmail(params: {
  to: string;
  name?: string | null;
}): Promise<boolean> {
  const recipient = getFirstName(params.name);
  const greeting = recipient ? `Hi ${recipient},` : "Hi there,";
  const appUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  return sendEmail({
    to: params.to,
    subject: "Welcome to Zoomies",
    text: `${greeting}\n\nWelcome to Zoomies. Your account is ready and you can start exploring rides now: ${appUrl}\n\nRide safe,\nTeam Zoomies`,
    html: `<p>${greeting}</p><p>Welcome to <strong>Zoomies</strong>. Your account is ready and you can start exploring rides now.</p><p><a href="${appUrl}">Open Zoomies</a></p><p>Ride safe,<br/>Team Zoomies</p>`,
  });
}
