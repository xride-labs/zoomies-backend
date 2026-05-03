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
  // Page
  pageBg: "#0F0F0F",
  // Header
  headerBg: "#141414",
  headerBorder: "#2A2A2A",
  // Card
  cardBg: "#1A1A1A",
  softBg: "#222222",
  border: "#2C2C2C",
  borderStrong: "#3A3A3A",
  // Text
  text: "#F4F4F5",
  textSoft: "#D4D4D8",
  muted: "#71717A",
  mutedStrong: "#A1A1AA",
  // Accent
  accent: "#DC2626",
  accentSoft: "#3F0D0D",
  teal: "#37C8C3",
  tealSoft: "#0D2F2E",
  // CTA
  ctaBg: "#DC2626",
  ctaText: "#FFFFFF",
  // Footer
  footerBg: "#111111",
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.softBg};overflow:hidden;">
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
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
          style="background:${BRAND.softBg};border:1px solid ${BRAND.teal}40;border-radius:12px;">
          <tr>
            <td align="center" style="padding:28px 20px 30px 20px;">
              <div style="font-family:${FONT_STACK};font-size:11px;font-weight:700;color:${BRAND.teal};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;">${escapeHtml(label)}</div>
              <div style="font-family:${MONO_STACK};font-size:38px;font-weight:700;letter-spacing:10px;color:${BRAND.teal};line-height:1;text-shadow:0 0 20px ${BRAND.teal}60;">${escapeHtml(value)}</div>
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
            <td style="border-radius:10px;background:${BRAND.ctaBg};box-shadow:0 2px 12px ${BRAND.accent}40;">
              <a href="${safeUrl}" target="_blank" rel="noopener"
                style="display:inline-block;padding:14px 28px;font-family:${FONT_STACK};font-size:15px;font-weight:700;color:${BRAND.ctaText};text-decoration:none;border-radius:10px;letter-spacing:0.01em;">${escapeHtml(label)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 0 24px 0;">
        <div style="font-family:${FONT_STACK};font-size:12px;line-height:1.6;color:${BRAND.muted};">
          Or copy this link:&nbsp;
          <a href="${safeUrl}" target="_blank" rel="noopener" style="color:${BRAND.teal};text-decoration:underline;word-break:break-all;">${safeUrl}</a>
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
            <td style="padding:0 0 18px 0;">
              <span style="display:inline-block;font-family:${FONT_STACK};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${BRAND.teal};background:${BRAND.tealSoft};padding:5px 12px;border-radius:20px;border:1px solid ${BRAND.teal}40;">${escapeHtml(params.badge)}</span>
            </td>
          </tr>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(params.heading)}</title>
    <style>
      @media only screen and (max-width: 600px) {
        .email-card { padding: 28px 20px !important; }
        .email-header { padding: 18px 20px !important; }
        .email-footer { padding: 20px 20px 0 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${BRAND.pageBg};font-family:${FONT_STACK};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

    <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->

    <!-- Preheader -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.pageBg};">${escapeHtml(params.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.pageBg};padding:40px 16px 32px 16px;">
      <tr>
        <td align="center">

          <!-- Outer wrapper -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

            <!-- ── Logo Header ──────────────────────────────────────────── -->
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="background-color:${BRAND.headerBg};border:1px solid ${BRAND.headerBorder};border-radius:14px 14px 0 0;padding:0;">
                  <tr>
                    <td class="email-header" style="padding:22px 32px;">
                      <table cellpadding="0" cellspacing="0" role="presentation" width="100%">
                        <tr>
                          <td valign="middle">
                            <table cellpadding="0" cellspacing="0" role="presentation">
                              <tr>
                                <td valign="middle" style="padding-right:12px;">
                                  <img src="${ICON_URL}" alt="" width="36" height="36"
                                    style="display:block;width:36px;height:36px;border:0;outline:none;border-radius:10px;" />
                                </td>
                                <td valign="middle">
                                  <div style="font-family:${FONT_STACK};font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.02em;line-height:1;">ZOOMIES</div>
                                  <div style="font-family:${FONT_STACK};font-size:11px;color:${BRAND.teal};letter-spacing:0.06em;text-transform:uppercase;margin-top:2px;">Ride Together</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                          <td valign="middle" align="right">
                            <!-- Decorative teal dot accent -->
                            <div style="width:8px;height:8px;border-radius:50%;background:${BRAND.teal};display:inline-block;"></div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Teal accent line at bottom of header -->
                  <tr>
                    <td style="padding:0;">
                      <div style="height:2px;background:linear-gradient(90deg,${BRAND.teal},${BRAND.accent},transparent);border-radius:0;"></div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- ── Card Body ───────────────────────────────────────────── -->
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="background-color:${BRAND.cardBg};border:1px solid ${BRAND.border};border-top:0;border-radius:0 0 14px 14px;">
                  <tr>
                    <td class="email-card" style="padding:36px 32px 32px 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        ${badge}
                        <tr>
                          <td style="padding:0 0 8px 0;">
                            <h1 style="margin:0;font-family:${FONT_STACK};font-size:26px;line-height:1.2;font-weight:700;color:${BRAND.text};letter-spacing:-0.025em;">${escapeHtml(params.heading)}</h1>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 26px 0;">
                            <p style="margin:0;font-family:${FONT_STACK};font-size:15px;line-height:1.6;color:${BRAND.muted};">${escapeHtml(params.subtitle)}</p>
                          </td>
                        </tr>
                        <!-- Divider -->
                        <tr>
                          <td style="padding:0 0 22px 0;">
                            <div style="height:1px;background:${BRAND.border};"></div>
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
              </td>
            </tr>

            <!-- ── Footer ─────────────────────────────────────────────── -->
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                  style="background-color:${BRAND.footerBg};border:1px solid ${BRAND.headerBorder};border-top:0;border-radius:0 0 8px 8px;margin-top:2px;">
                  <tr>
                    <td class="email-footer" style="padding:20px 32px 24px 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="font-family:${FONT_STACK};font-size:12px;line-height:1.7;color:${BRAND.muted};">
                            <div style="margin-bottom:6px;">
                              <span style="color:${BRAND.mutedStrong};font-weight:600;">Zoomies</span>
                              <span style="color:${BRAND.muted};">&nbsp;&middot;&nbsp;by Xride Labs</span>
                            </div>
                            <div style="margin-bottom:8px;">
                              Questions? <a href="mailto:hello@xride-labs.in" style="color:${BRAND.teal};text-decoration:none;">hello@xride-labs.in</a>
                            </div>
                            <div style="color:#52525B;">&copy; ${CURRENT_YEAR} Xride Labs. All rights reserved.</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
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
    heading: "Your sign-in code",
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
    heading: "Your sign-in code",
    intro:
      "Use the code below to finish signing in to your Zoomies account.",
    codeLabel: "Verification code",
    codeValue: params.otp,
    legal: `This code expires in ${ttl} minutes. Never share this code with anyone.`,
  });

  return {
    subject: `${params.otp} — your Zoomies code`,
    html,
    text,
    tags: ["otp"],
  };
}

/** Combined welcome + OTP for brand-new users — one email instead of two. */
export function buildWelcomeOtpTemplate(params: {
  otp: string;
  expiresInMinutes?: number;
}): EmailTemplate {
  const ttl = params.expiresInMinutes || 10;
  const sections: TemplateSection[] = [
    {
      title: "Discover rides near you",
      description:
        "Browse group rides happening in your area and join the ones that match your pace.",
    },
    {
      title: "Join clubs & squads",
      description:
        "Build your rider network, plan meetups, and stay coordinated with your crew.",
    },
    {
      title: "Track every ride",
      description:
        "Record your routes, hit milestones, and share your adventures mile by mile.",
    },
  ];

  const html = buildHtml({
    preheader: `Welcome to Zoomies! Your verification code is ${params.otp}.`,
    badge: "Welcome to Zoomies",
    heading: "You're almost in.",
    subtitle:
      "Enter the code below to verify your email and create your rider profile.",
    greeting: "Hey, welcome aboard!",
    intro:
      "We're pumped to have you. Verify your email with the code below and you're ready to roll — discover rides, join clubs, and connect with riders near you.",
    codeLabel: "Your verification code",
    codeValue: params.otp,
    sections,
    legal: `This code expires in ${ttl} minutes. Zoomies will never ask for this code by phone or chat. If you didn't request this, you can safely ignore it.`,
  });

  const text = buildText({
    greeting: "Hey, welcome aboard!",
    heading: "Welcome to Zoomies",
    intro:
      "Verify your email with the code below and you're ready to roll.",
    codeLabel: "Your verification code",
    codeValue: params.otp,
    sections,
    legal: `This code expires in ${ttl} minutes. Never share it with anyone.`,
  });

  return {
    subject: `${params.otp} — welcome to Zoomies 🏍️`,
    html,
    text,
    tags: ["otp", "welcome"],
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
