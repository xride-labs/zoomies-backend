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
  bg: "#030303",
  panel: "#0E0E0E",
  panelAlt: "#151515",
  border: "#1D1D1D",
  text: "#F5F5F5",
  muted: "#9D9D9D",
  accentRed: "#FF2D2D",
  accentTeal: "#00FFD1",
  accentAmber: "#FFC857",
};

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

  return sections
    .map((section, index) => {
      const accent = index % 2 === 0 ? BRAND.accentRed : BRAND.accentTeal;

      return `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid ${BRAND.border};border-radius:18px;background:${BRAND.panelAlt};overflow:hidden;">
            <tr>
              <td style="width:4px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
              <td style="padding:14px 16px 15px 16px;">
                <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${accent};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(section.title)}</div>
                <div style="font-size:14px;line-height:1.65;color:${BRAND.text};margin-top:7px;font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(section.description)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");
}

function renderCodeBlock(label?: string, value?: string): string {
  if (!label || !value) {
    return "";
  }

  return `
    <tr>
      <td style="padding:4px 0 18px 0;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${BRAND.accentTeal};margin-bottom:10px;font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(label)}</div>
        <div style="display:inline-block;background:${BRAND.bg};border:1px solid ${BRAND.border};box-shadow:inset 0 0 0 1px rgba(255,45,45,0.14);color:${BRAND.text};padding:14px 18px;border-radius:16px;font-size:26px;font-weight:800;letter-spacing:6px;font-family:'Syne','Arial Black',Arial,sans-serif;">${escapeHtml(value)}</div>
      </td>
    </tr>`;
}

function renderCta(label?: string, url?: string): string {
  if (!label || !url) {
    return "";
  }

  return `
    <tr>
      <td style="padding:4px 0 22px 0;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:${BRAND.accentRed};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;padding:14px 20px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(label)} -></a>
      </td>
    </tr>`;
}

function buildHtml(params: LayoutParams): string {
  const sections = renderSections(params.sections);
  const codeBlock = renderCodeBlock(params.codeLabel, params.codeValue);
  const cta = renderCta(params.ctaLabel, params.ctaUrl);
  const outro = params.outro
    ? `<tr><td style="padding:0 0 16px 0;font-size:14px;line-height:1.72;color:${BRAND.text};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.outro)}</td></tr>`
    : "";
  const legal = params.legal
    ? `<tr><td style="padding:18px 0 0 0;font-size:12px;line-height:1.7;color:${BRAND.muted};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.legal)}</td></tr>`
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.bg};font-family:'DM Sans',Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:28px 12px;">
      <tr>
        <td align="center">
          <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="max-width:640px;background:${BRAND.panel};border-radius:28px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 30px 80px rgba(0,0,0,0.45);">
            <tr>
              <td>
                <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="height:4px;background:${BRAND.accentRed};font-size:0;line-height:0;">&nbsp;</td>
                    <td style="height:4px;background:${BRAND.accentTeal};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 24px 8px 24px;">
                <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${BRAND.accentTeal};font-family:'DM Sans',Arial,sans-serif;padding-bottom:6px;">XRIDE LABS</td>
                  </tr>
                  <tr>
                    <td style="font-size:30px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:${BRAND.text};font-family:'Syne','Arial Black',Arial,sans-serif;">Zoomies</td>
                  </tr>
                  <tr>
                    <td style="font-size:13px;line-height:1.7;color:${BRAND.muted};font-family:'DM Sans',Arial,sans-serif;padding-top:4px;">Riders first. Built by Xride Labs.</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 24px 24px 24px;">
                <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:22px;overflow:hidden;">
                  <tr>
                    <td style="padding:22px 22px 8px 22px;background:linear-gradient(180deg, rgba(255,45,45,0.12) 0%, rgba(255,45,45,0.02) 58%, rgba(0,0,0,0) 100%);">
                      <div style="display:inline-block;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:${BRAND.accentAmber};font-size:11px;font-weight:800;padding:7px 11px;border-radius:999px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:14px;font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.badge)}</div>
                      <h1 style="margin:0 0 8px 0;font-size:30px;line-height:1.12;color:${BRAND.text};font-family:'Syne','Arial Black',Arial,sans-serif;letter-spacing:-0.02em;">${escapeHtml(params.heading)}</h1>
                      <p style="margin:0 0 18px 0;font-size:15px;line-height:1.7;color:${BRAND.muted};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.subtitle)}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 22px 22px 22px;">
                      <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:0 0 14px 0;font-size:14px;line-height:1.72;color:${BRAND.text};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.greeting)}</td>
                        </tr>
                        <tr>
                          <td style="padding:0 0 16px 0;font-size:14px;line-height:1.72;color:${BRAND.text};font-family:'DM Sans',Arial,sans-serif;">${escapeHtml(params.intro)}</td>
                        </tr>
                        ${sections}
                        ${codeBlock}
                        ${cta}
                        ${outro}
                        ${legal}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 24px 24px;">
                <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BRAND.border};">
                  <tr>
                    <td style="padding-top:18px;font-size:12px;line-height:1.8;color:${BRAND.muted};font-family:'DM Sans',Arial,sans-serif;">
                      Need help? Reply to this email or contact <a href="mailto:hello@xride-labs.in" style="color:${BRAND.text};text-decoration:none;">hello@xride-labs.in</a>.<br />
                      <span style="color:${BRAND.accentRed};">Never Stop Riding</span> &nbsp; <span style="color:${BRAND.muted};">/</span> &nbsp; <span style="color:${BRAND.accentTeal};">Xride Labs</span>
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
    .join("\n\n");
  const code =
    params.codeLabel && params.codeValue
      ? `${params.codeLabel}: ${params.codeValue}`
      : "";
  const cta =
    params.ctaLabel && params.ctaUrl
      ? `${params.ctaLabel}: ${params.ctaUrl}`
      : "";

  return [
    params.greeting,
    params.heading,
    params.intro,
    sectionLines,
    code,
    cta,
    params.outro || "",
    params.legal || "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildWelcomeTemplate(params: {
  name?: string | null;
  appUrl: string;
}): EmailTemplate {
  const firstName = getFirstName(params.name);
  const greeting = firstName ? `Welcome ${firstName},` : "Welcome rider,";
  const sections: TemplateSection[] = [
    {
      title: "Discover nearby rides",
      description: "Find routes and events near your location in seconds.",
    },
    {
      title: "Join clubs and friend groups",
      description: "Ride with your community and manage meetups from one app.",
    },
    {
      title: "Complete your profile",
      description: "Add your bike and preferences for better ride matches.",
    },
  ];

  const html = buildHtml({
    preheader: "Your Zoomies account is ready",
    badge: "ONBOARDING",
    heading: "Welcome to Zoomies",
    subtitle: "Your rider profile is now active",
    greeting,
    intro:
      "You are all set. Here are the first things to do to get the most from Zoomies:",
    sections,
    ctaLabel: "Open Zoomies",
    ctaUrl: params.appUrl,
  });

  const text = buildText({
    greeting,
    heading: "Welcome to Zoomies",
    intro: "Your rider profile is now active.",
    sections,
    ctaLabel: "Open Zoomies",
    ctaUrl: params.appUrl,
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
  const greeting = firstName ? `Hey ${firstName},` : "Hey rider,";

  const html = buildHtml({
    preheader: "Verify your Zoomies account",
    badge: "ACCOUNT SECURITY",
    heading: "Verify your email",
    subtitle: "One quick step before you continue",
    greeting,
    intro:
      "Please confirm your email address to keep your account secure and unlock full access.",
    ctaLabel: "Verify Email",
    ctaUrl: params.verifyUrl,
    legal: "If you did not create this account, you can ignore this email.",
  });

  const text = buildText({
    greeting,
    heading: "Verify your email",
    intro:
      "Please confirm your email address to keep your account secure and unlock full access.",
    ctaLabel: "Verify Email",
    ctaUrl: params.verifyUrl,
    legal: "If you did not create this account, you can ignore this email.",
  });

  return {
    subject: "Verify your Zoomies account",
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
  const greeting = firstName ? `Hey ${firstName},` : "Hey rider,";
  const ttl = params.expiresInMinutes || 10;

  const html = buildHtml({
    preheader: "Your Zoomies OTP code",
    badge: "SECURE LOGIN",
    heading: "Your one-time code",
    subtitle: "Use this code to continue",
    greeting,
    intro: "Enter this code in the app to complete your sign-in.",
    codeLabel: "Verification code",
    codeValue: params.otp,
    legal: `This code expires in ${ttl} minutes. Never share it with anyone.`,
  });

  const text = buildText({
    greeting,
    heading: "Your one-time code",
    intro: "Enter this code in the app to complete your sign-in.",
    codeLabel: "Verification code",
    codeValue: params.otp,
    legal: `This code expires in ${ttl} minutes. Never share it with anyone.`,
  });

  return {
    subject: "Your Zoomies OTP code",
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
  const greeting = firstName ? `Hey ${firstName},` : "Hey rider,";

  const html = buildHtml({
    preheader: "Reset your Zoomies password",
    badge: "ACCOUNT SECURITY",
    heading: "Reset your password",
    subtitle: "You requested a password reset",
    greeting,
    intro:
      "If this request came from you, use the button below to set a new password.",
    ctaLabel: "Reset Password",
    ctaUrl: params.resetUrl,
    legal:
      "If you did not request this, you can ignore this email. Your account remains secure.",
  });

  const text = buildText({
    greeting,
    heading: "Reset your password",
    intro:
      "If this request came from you, use the link below to set a new password.",
    ctaLabel: "Reset Password",
    ctaUrl: params.resetUrl,
    legal:
      "If you did not request this, you can ignore this email. Your account remains secure.",
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
    {
      title: "Ride",
      description: params.rideTitle,
    },
    {
      title: "Requested by",
      description: params.requesterName,
    },
  ];

  if (params.message) {
    sections.push({
      title: "Message",
      description: params.message,
    });
  }

  const html = buildHtml({
    preheader: `New join request for ${params.rideTitle}`,
    badge: "RIDE UPDATE",
    heading: "New ride join request",
    subtitle: "A rider wants to join your ride",
    greeting: "Hey there,",
    intro: "You received a new request. Open the app to approve or reject it.",
    sections,
  });

  const text = buildText({
    greeting: "Hey there,",
    heading: "New ride join request",
    intro: "You received a new request. Open the app to approve or reject it.",
    sections,
  });

  return {
    subject: `New join request for ${params.rideTitle}`,
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
    {
      title: "Club",
      description: params.clubName,
    },
    {
      title: "New member",
      description: params.memberName,
    },
  ];

  const html = buildHtml({
    preheader: `New member joined ${params.clubName}`,
    badge: "CLUB UPDATE",
    heading: "New club member",
    subtitle: "Your community is growing",
    greeting: "Hey captain,",
    intro:
      "A new rider joined your club. Open your club dashboard to welcome them.",
    sections,
    ctaLabel: "Open Club",
    ctaUrl: params.clubsUrl,
  });

  const text = buildText({
    greeting: "Hey captain,",
    heading: "New club member",
    intro:
      "A new rider joined your club. Open your club dashboard to welcome them.",
    sections,
    ctaLabel: "Open Club",
    ctaUrl: params.clubsUrl,
  });

  return {
    subject: `New member joined ${params.clubName}`,
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
    badge: "SYSTEM ALERT",
    heading: params.subject,
    subtitle: "Important update",
    greeting: "Heads up,",
    intro: params.message,
  });

  const text = buildText({
    greeting: "Heads up,",
    heading: params.subject,
    intro: params.message,
  });

  return {
    subject: params.subject,
    html,
    text,
    tags: ["alert"],
  };
}
