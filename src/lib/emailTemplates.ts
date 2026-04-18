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
    .map(
      (section) => `
      <tr>
        <td style="padding:0 0 12px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb;">
            <tr>
              <td style="padding:12px 14px;">
                <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(section.title)}</div>
                <div style="font-size:13px;line-height:1.5;color:#4b5563;margin-top:4px;">${escapeHtml(section.description)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`,
    )
    .join("");
}

function renderCodeBlock(label?: string, value?: string): string {
  if (!label || !value) {
    return "";
  }

  return `
    <tr>
      <td style="padding:0 0 16px 0;">
        <div style="font-size:13px;color:#6b7280;margin-bottom:8px;">${escapeHtml(label)}</div>
        <div style="display:inline-block;background:#111827;color:#ffffff;padding:10px 16px;border-radius:10px;font-size:24px;font-weight:700;letter-spacing:4px;">${escapeHtml(value)}</div>
      </td>
    </tr>`;
}

function renderCta(label?: string, url?: string): string {
  if (!label || !url) {
    return "";
  }

  return `
    <tr>
      <td style="padding:0 0 18px 0;">
        <a href="${escapeHtml(url)}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:10px;">${escapeHtml(label)}</a>
      </td>
    </tr>`;
}

function buildHtml(params: LayoutParams): string {
  const sections = renderSections(params.sections);
  const codeBlock = renderCodeBlock(params.codeLabel, params.codeValue);
  const cta = renderCta(params.ctaLabel, params.ctaUrl);
  const outro = params.outro
    ? `<tr><td style="padding:0 0 14px 0;font-size:14px;line-height:1.6;color:#1f2937;">${escapeHtml(params.outro)}</td></tr>`
    : "";
  const legal = params.legal
    ? `<tr><td style="padding:14px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;">${escapeHtml(params.legal)}</td></tr>`
    : "";

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(params.heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(params.preheader)}</div>
    <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 10px;">
      <tr>
        <td align="center">
          <table width="100%" role="presentation" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:24px 24px 20px 24px;background:#111827;">
                <div style="color:#f9fafb;font-size:22px;font-weight:800;">Zoomies</div>
                <div style="color:#d1d5db;font-size:13px;margin-top:4px;">Ride. Connect. Explore.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <div style="display:inline-block;background:#111827;color:#f59e0b;font-size:11px;font-weight:700;padding:6px 10px;border-radius:999px;letter-spacing:0.8px;margin-bottom:12px;">${escapeHtml(params.badge)}</div>
                <h1 style="margin:0 0 8px 0;font-size:24px;line-height:1.3;color:#111827;">${escapeHtml(params.heading)}</h1>
                <p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;color:#4b5563;">${escapeHtml(params.subtitle)}</p>
                <table width="100%" role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0 0 14px 0;font-size:14px;line-height:1.6;color:#111827;">${escapeHtml(params.greeting)}</td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 14px 0;font-size:14px;line-height:1.6;color:#1f2937;">${escapeHtml(params.intro)}</td>
                  </tr>
                  ${sections}
                  ${codeBlock}
                  ${cta}
                  ${outro}
                  ${legal}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e5e7eb;background:#f9fafb;font-size:12px;color:#6b7280;line-height:1.5;">
                Need help? Reply to this email and our team will assist you.
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
