export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
  tags: string[];
};

type TemplateSection = {
  title: string;
  description: string;
};

type LayoutParams = {
  preheader: string;
  badge: string;
  heading: string;
  subtitle: string;
  greeting: string;
  intro: string;
  sections?: TemplateSection[];
  codeLabel?: string;
  codeValue?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  outro?: string;
  legal?: string;
};

const BRAND = {
  pageBg: "#F4F4F5",
  cardBg: "#FFFFFF",
  softBg: "#FAFAFA",
  border: "#E4E4E7",
  borderStrong: "#D4D4D8",
  text: "#09090B",
  textSoft: "#27272A",
  muted: "#71717A",
  mutedStrong: "#52525B",
  accent: "#DC2626",
  accentSoft: "#FEF2F2",
  ctaBg: "#09090B",
  ctaText: "#FFFFFF",
};

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO_STACK =
  "'SF Mono', ui-monospace, Menlo, Consolas, 'Roboto Mono', monospace";

function getAssetBaseUrl(): string {
  const raw =
    process.env.PUBLIC_ASSET_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    process.env.BACKEND_URL?.trim() ||
    "http://localhost:5000";
  return raw.replace(/\/+$/, "");
}

const ICON_URL = `${getAssetBaseUrl()}/static/email-assets/zoomies-icon.png`;
const CURRENT_YEAR = new Date().getFullYear();

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeName(name?: string | null): string | undefined {
  if (!name) {
    return undefined;
  }
  const trimmed = name.trim();
  return trimmed.length ? trimmed : undefined;
}

export function getFirstName(name?: string | null): string | undefined {
  const normalized = normalizeName(name);
  if (!normalized) {
    return undefined;
  }
  return normalized.split(/\s+/)[0];
}

function renderSections(sections: TemplateSection[] = []): string {
  if (!sections.length) {
    return "";
  }

  const rows = sections
    .map((section, index) => {
      const topBorder =
        index === 0 ? "" : `border-top:1px solid ${BRAND.border};`;
      return `
      <tr>
        <td style="padding:14px 18px;${topBorder}">
          <div style="font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${BRAND.muted};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:4px;">${escapeHtml(section.title)}</div>
          <div style="font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.textSoft};">${escapeHtml(section.description)}</div>
        </td>
      </tr>`;
    })
    .join("");

  return `
    <tr>
      <td style="padding:8px 0 24px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${BRAND.border};border-radius:10px;background:${BRAND.softBg};overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>`;
}

function renderCodeBlock(label?: string, value?: string): string {
  if (!label || !value) {
    return "";
  }

  return `
    <tr>
      <td style="padding:8px 0 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${BRAND.softBg};border:1px solid ${BRAND.border};border-radius:10px;">
          <tr>
            <td align="center" style="padding:22px 20px 24px 20px;">
              <div style="font-family:${FONT_STACK};font-size:12px;font-weight:600;color:${BRAND.muted};letter-spacing:0.06em;text-transform:uppercase;margin-bottom:12px;">${escapeHtml(label)}</div>
              <div style="font-family:${MONO_STACK};font-size:30px;font-weight:600;letter-spacing:8px;color:${BRAND.text};line-height:1;">${escapeHtml(value)}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderCta(label?: string, url?: string): string {
  if (!label || !url) {
    return "";
  }

  const safeUrl = escapeHtml(url);

  return `
    <tr>
      <td style="padding:8px 0 20px 0;">
        <table cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td style="border-radius:8px;background:${BRAND.ctaBg};">
              <a href="${safeUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 24px;font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${BRAND.ctaText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 24px 0;">
        <div style="font-family:${FONT_STACK};font-size:13px;line-height:1.6;color:${BRAND.muted};">
          Or copy and paste this link into your browser:<br />
          <a href="${safeUrl}" target="_blank" rel="noopener" style="color:${BRAND.mutedStrong};text-decoration:underline;word-break:break-all;">${safeUrl}</a>
        </div>
      </td>
    </tr>`;
}

function buildHtml(params: LayoutParams): string {
  const sections = renderSections(params.sections);
  const codeBlock = renderCodeBlock(params.codeLabel, params.codeValue);
  const cta = renderCta(params.ctaLabel, params.ctaUrl);
  const outro = params.outro
    ? `<tr><td style="padding:0 0 20px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.textSoft};">${escapeHtml(params.outro)}</td></tr>`
    : "";
  const legal = params.legal
    ? `<tr><td style="padding:20px 0 0 0;border-top:1px solid ${BRAND.border};font-family:${FONT_STACK};font-size:13px;line-height:1.65;color:${BRAND.muted};">${escapeHtml(params.legal)}</td></tr>`
    : "";
  const badge = params.badge
    ? `
          <tr>
            <td style="padding:0 0 14px 0;">
              <span style="display:inline-block;font-family:${FONT_STACK};font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.accent};background:${BRAND.accentSoft};padding:5px 10px;border-radius:6px;">${escapeHtml(params.badge)}</span>
            </td>
          </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(params.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.pageBg};">${escapeHtml(params.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.pageBg};padding:32px 16px;">
      <tr>
        <td align="center">

          <!-- Header -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 4px 20px 4px;">
                <table cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td valign="middle" style="padding-right:10px;">
                      <img src="${ICON_URL}" alt="Zoomies" width="28" height="28" style="display:block;width:28px;height:28px;border:0;outline:none;border-radius:6px;" />
                    </td>
                    <td valign="middle" style="font-family:${FONT_STACK};font-size:15px;font-weight:600;color:${BRAND.text};letter-spacing:-0.01em;">Zoomies</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <!-- Card -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:12px;">
            <tr>
              <td style="padding:36px 36px 32px 36px;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  ${badge}
                  <tr>
                    <td style="padding:0 0 10px 0;">
                      <h1 style="margin:0;font-family:${FONT_STACK};font-size:24px;line-height:1.25;font-weight:700;color:${BRAND.text};letter-spacing:-0.02em;">${escapeHtml(params.heading)}</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px 0;">
                      <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(params.subtitle)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 14px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.textSoft};">${escapeHtml(params.greeting)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 20px 0;font-family:${FONT_STACK};font-size:15px;line-height:1.65;color:${BRAND.textSoft};">${escapeHtml(params.intro)}</td>
                  </tr>
                  ${codeBlock}
                  ${cta}
                  ${sections}
                  ${outro}
                  ${legal}
                </table>
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <tr>
              <td style="padding:24px 4px 0 4px;font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
                <div style="margin-bottom:6px;color:${BRAND.mutedStrong};">Zoomies &middot; by Xride Labs</div>
                <div style="margin-bottom:10px;">
                  Need help? Email
                  <a href="mailto:hello@xride-labs.in" style="color:${BRAND.mutedStrong};text-decoration:underline;">hello@xride-labs.in</a>
                </div>
                <div style="color:#A1A1AA;">&copy; ${CURRENT_YEAR} Xride Labs. All rights reserved.</div>
              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>

  </body>
</html>`.trim();
}

function buildText(params: {
  greeting: string;
  heading: string;
  intro: string;
  sections?: TemplateSection[];
  codeLabel?: string;
  codeValue?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  outro?: string;
  legal?: string;
}): string {
  const sectionLines = (params.sections || [])
    .map((section) => `${section.title}: ${section.description}`)
    .join("\n");
  const code =
    params.codeLabel && params.codeValue
      ? `${params.codeLabel}: ${params.codeValue}`
      : "";
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `${params.ctaLabel}: ${params.ctaUrl}`
      : "";

  return [
    params.heading,
    "",
    params.greeting,
    params.intro,
    code,
    cta,
    sectionLines,
    params.outro || "",
    params.legal || "",
    "",
    "— Zoomies by Xride Labs",
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function buildWelcomeTemplate(params: {
  name?: string | null;
  appUrl: string;
}): EmailTemplate {
  const firstName = getFirstName(params.name);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const sections: TemplateSection[] = [
    {
      title: "Discover rides near you",
      description:
        "Browse group rides and solo routes happening in your area, and join the ones that match your pace.",
    },
    {
      title: "Join clubs and crews",
      description:
        "Connect with riding communities, plan meetups, and keep your group coordinated in one place.",
    },
    {
      title: "Complete your profile",
      description:
        "Add your bike, experience level, and preferences so we can match you with the right rides and riders.",
    },
  ];

  const html = buildHtml({
    preheader: "Your Zoomies account is ready. Here's how to get started.",
    badge: "Welcome",
    heading: "Welcome to Zoomies",
    subtitle:
      "Your rider account is active. Here are a few things to do to get the most out of it.",
    greeting,
    intro:
      "Zoomies is the home for motorcycle riders — to discover rides, join clubs, and connect with the community. Below are a few ways to get started.",
    sections,
    ctaLabel: "Open Zoomies",
    ctaUrl: params.appUrl,
    outro:
      "If you have any questions, just reply to this email — we read every message.",
  });

  const text = buildText({
    greeting,
    heading: "Welcome to Zoomies",
    intro:
      "Your rider account is now active. Here are a few things to do to get the most out of it.",
    sections,
    ctaLabel: "Open Zoomies",
    ctaUrl: params.appUrl,
    outro: "If you have any questions, just reply to this email.",
  });

  return {
    subject: "Welcome to Zoomies",
    html,
    text,
    tags: ["onboarding", "welcome"],
  };
}

export function buildVerificationTemplate(params: {
  name?: string | null;
  verifyUrl: string;
}): EmailTemplate {
  const firstName = getFirstName(params.name);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const html = buildHtml({
    preheader: "Confirm your email address to activate your Zoomies account.",
    badge: "Verify email",
    heading: "Confirm your email address",
    subtitle:
      "Please verify your email to activate your account and secure it against unauthorized access.",
    greeting,
    intro:
      "Click the button below to confirm the email address associated with your Zoomies account. This link is valid for a limited time.",
    ctaLabel: "Verify email address",
    ctaUrl: params.verifyUrl,
    legal:
      "If you did not create a Zoomies account, you can safely ignore this email — no further action is required.",
  });

  const text = buildText({
    greeting,
    heading: "Confirm your email address",
    intro:
      "Click the link below to confirm the email address associated with your Zoomies account. This link is valid for a limited time.",
    ctaLabel: "Verify email address",
    ctaUrl: params.verifyUrl,
    legal:
      "If you did not create a Zoomies account, you can safely ignore this email.",
  });

  return {
    subject: "Confirm your email address",
    html,
    text,
    tags: ["verify-email"],
  };
}

export function buildOtpTemplate(params: {
  name?: string | null;
  otp: string;
  expiresInMinutes?: number;
}): EmailTemplate {
  const firstName = getFirstName(params.name);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";
  const ttl = params.expiresInMinutes || 10;

  const html = buildHtml({
    preheader: `Your Zoomies verification code is ${params.otp}.`,
    badge: "One-time code",
    heading: "Your verification code",
    subtitle:
      "Enter this code in the app to complete sign-in. Do not share it with anyone.",
    greeting,
    intro:
      "Use the code below to finish signing in to your Zoomies account.",
    codeLabel: "Verification code",
    codeValue: params.otp,
    legal: `This code expires in ${ttl} minutes. Zoomies will never ask you for this code by phone, email, or chat. If you did not request it, you can safely ignore this message.`,
  });

  const text = buildText({
    greeting,
    heading: "Your verification code",
    intro:
      "Use the code below to finish signing in to your Zoomies account.",
    codeLabel: "Verification code",
    codeValue: params.otp,
    legal: `This code expires in ${ttl} minutes. Never share this code with anyone.`,
  });

  return {
    subject: `Zoomies verification code: ${params.otp}`,
    html,
    text,
    tags: ["otp"],
  };
}

export function buildResetPasswordTemplate(params: {
  name?: string | null;
  resetUrl: string;
}): EmailTemplate {
  const firstName = getFirstName(params.name);
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  const html = buildHtml({
    preheader: "Reset your Zoomies account password.",
    badge: "Password reset",
    heading: "Reset your password",
    subtitle:
      "We received a request to reset the password for your Zoomies account.",
    greeting,
    intro:
      "If you made this request, click the button below to choose a new password. For your security, this link will expire soon.",
    ctaLabel: "Reset password",
    ctaUrl: params.resetUrl,
    legal:
      "If you did not request a password reset, you can safely ignore this email — your account remains secure and no changes will be made.",
  });

  const text = buildText({
    greeting,
    heading: "Reset your password",
    intro:
      "If you requested a password reset, click the link below to choose a new password. For your security, this link will expire soon.",
    ctaLabel: "Reset password",
    ctaUrl: params.resetUrl,
    legal:
      "If you did not request a password reset, you can safely ignore this email.",
  });

  return {
    subject: "Reset your Zoomies password",
    html,
    text,
    tags: ["reset-password"],
  };
}

export function buildRideJoinRequestTemplate(params: {
  rideTitle: string;
  requesterName: string;
  message?: string;
}): EmailTemplate {
  const sections: TemplateSection[] = [
    { title: "Ride", description: params.rideTitle },
    { title: "Requested by", description: params.requesterName },
  ];

  if (params.message) {
    sections.push({ title: "Message", description: params.message });
  }

  const html = buildHtml({
    preheader: `${params.requesterName} requested to join ${params.rideTitle}.`,
    badge: "Ride request",
    heading: "New request to join your ride",
    subtitle:
      "A rider has requested to join one of your rides. Review the details below and respond in the app.",
    greeting: "Hi there,",
    intro:
      "Open Zoomies to view the full request and approve or decline it. The requester will be notified of your decision.",
    sections,
  });

  const text = buildText({
    greeting: "Hi there,",
    heading: "New request to join your ride",
    intro:
      "A rider has requested to join one of your rides. Open Zoomies to approve or decline the request.",
    sections,
  });

  return {
    subject: `New join request: ${params.rideTitle}`,
    html,
    text,
    tags: ["ride-join-request"],
  };
}

export function buildClubJoinTemplate(params: {
  clubName: string;
  memberName: string;
  clubsUrl: string;
}): EmailTemplate {
  const sections: TemplateSection[] = [
    { title: "Club", description: params.clubName },
    { title: "New member", description: params.memberName },
  ];

  const html = buildHtml({
    preheader: `${params.memberName} just joined ${params.clubName}.`,
    badge: "Club update",
    heading: "A new member joined your club",
    subtitle: "Your club is growing. Open your club page to welcome them.",
    greeting: "Hi there,",
    intro:
      "A rider just joined your club on Zoomies. You can manage your members and community from your club dashboard.",
    sections,
    ctaLabel: "Open club",
    ctaUrl: params.clubsUrl,
  });

  const text = buildText({
    greeting: "Hi there,",
    heading: "A new member joined your club",
    intro:
      "A rider just joined your club on Zoomies. You can manage your members and community from your club dashboard.",
    sections,
    ctaLabel: "Open club",
    ctaUrl: params.clubsUrl,
  });

  return {
    subject: `New member in ${params.clubName}`,
    html,
    text,
    tags: ["club-member"],
  };
}

export function buildAlertTemplate(params: {
  subject: string;
  message: string;
}): EmailTemplate {
  const html = buildHtml({
    preheader: params.subject,
    badge: "Notice",
    heading: params.subject,
    subtitle: "Important account update",
    greeting: "Hi there,",
    intro: params.message,
    legal:
      "This is an automated system notice from Zoomies. If you believe you received it in error, please reply and let us know.",
  });

  const text = buildText({
    greeting: "Hi there,",
    heading: params.subject,
    intro: params.message,
    legal:
      "This is an automated system notice from Zoomies. If you believe you received it in error, please reply and let us know.",
  });

  return {
    subject: params.subject,
    html,
    text,
    tags: ["alert"],
  };
}
