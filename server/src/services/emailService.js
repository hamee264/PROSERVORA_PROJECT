const nodemailer = require("nodemailer");

const BRAND_NAME = "Proservora";
const BRAND_GREEN = "#1f8f5f";
const DEEP_EMERALD = "#123c32";
const IVORY = "#f6f8f4";

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const createEmailTemplate = ({
  eyebrow,
  title,
  greeting,
  intro,
  code,
  expiryText,
  securityText,
  plainText,
  details = [],
}) => ({
  text: plainText,
  html: `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="margin:0;padding:0;background:${IVORY};font-family:Arial,Helvetica,sans-serif;color:#26352f;">
        <div style="padding:32px 16px;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3ebe5;border-radius:16px;overflow:hidden;">
            <div style="padding:26px 32px;background:${DEEP_EMERALD};">
              <div style="font-size:22px;font-weight:700;letter-spacing:-0.4px;color:#ffffff;">${BRAND_NAME}</div>
              <div style="margin-top:7px;font-size:11px;letter-spacing:1.4px;font-weight:700;color:#b9e8ca;">${escapeHtml(eyebrow)}</div>
            </div>
            <div style="padding:34px 32px 30px;">
              <h1 style="margin:0;color:${DEEP_EMERALD};font-size:25px;line-height:1.25;font-weight:700;">${escapeHtml(title)}</h1>
              <p style="margin:24px 0 0;font-size:15px;line-height:1.7;">${greeting}</p>
              <p style="margin:12px 0 0;font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>
              ${details.length ? `<div style="margin:24px 0;padding:16px;border:1px solid #e3ebe5;border-radius:10px;background:#fbfcfb;">${details.map(({ label, value }) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52675d;"><strong style="color:${DEEP_EMERALD};">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`).join("")}</div>` : ""}
              ${code ? `
              <div style="margin:26px 0;padding:22px 16px;text-align:center;border:1px solid #cfe8d8;border-radius:12px;background:#f2fbf5;">
                <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5d7468;font-weight:700;">Your one-time code</div>
                <div style="margin-top:10px;color:${DEEP_EMERALD};font-size:34px;line-height:1.1;letter-spacing:9px;font-weight:700;">${escapeHtml(code)}</div>
              </div>
              ` : ""}
              <p style="margin:0;font-size:13px;line-height:1.6;color:#5d7468;">${escapeHtml(expiryText)}</p>
              <div style="margin-top:24px;padding:14px 16px;border-left:3px solid ${BRAND_GREEN};background:#f7faf8;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#52675d;">${escapeHtml(securityText)}</p>
              </div>
            </div>
            <div style="padding:20px 32px;border-top:1px solid #e8eee9;background:#fbfcfb;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#718078;">Need help? Contact <a href="mailto:${escapeHtml(supportEmail)}" style="color:${BRAND_GREEN};text-decoration:none;">${escapeHtml(supportEmail)}</a>.</p>
              <p style="margin:10px 0 0;font-size:12px;color:#91a098;">&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
    </html>
  `,
});

// ============================================================
// CONFIGURATION
// ============================================================

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 465);
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const emailFrom = process.env.EMAIL_FROM;
const supportEmail = process.env.SUPPORT_EMAIL || smtpUser;

if (!smtpHost) {
  throw new Error("SMTP_HOST is not configured");
}

if (!smtpUser) {
  throw new Error("SMTP_USER is not configured");
}

if (!smtpPass) {
  throw new Error("SMTP_PASS is not configured");
}

if (!emailFrom) {
  throw new Error("EMAIL_FROM is not configured");
}

// ============================================================
// SMTP TRANSPORT
// ============================================================

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

// ============================================================
// VERIFY SMTP CONNECTION
// ============================================================

const verifyEmailTransport = async () => {
  try {
    await transporter.verify();

    console.log("SMTP email transport is ready");
  } catch (error) {
    console.error("SMTP email transport verification failed:", {
      message: error.message,
      code: error.code,
      response: error.response,
    });

    throw error;
  }
};

const sendOperationalEmail = async ({
  email,
  subject,
  eyebrow,
  title,
  greeting = "Hello,",
  intro,
  details = [],
  securityText = "You can review this update in your Proservora account.",
  plainText,
}) => {
  if (!email) return null;

  const info = await transporter.sendMail({
    from: emailFrom,
    to: email,
    subject,
    ...createEmailTemplate({
      eyebrow,
      title,
      greeting,
      intro,
      details,
      expiryText: "",
      securityText,
      plainText,
    }),
  });

  console.log("Operational email sent successfully:", info.messageId);
  return info;
};

// ============================================================
// SEND VERIFICATION EMAIL
// ============================================================

const sendVerificationEmail = async (email, code, firstName) => {
  try {
    const safeFirstName = escapeHtml(firstName || "there");
    const info = await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: "Confirm your Proservora email address",
      ...createEmailTemplate({
        eyebrow: "ACCOUNT SECURITY",
        title: "Confirm your email address",
        greeting: `Hello ${safeFirstName},`,
        intro: "Welcome to Proservora. Enter this code in the app to finish setting up your account.",
        code,
        expiryText: "This verification code expires in 10 minutes.",
        securityText: "If you did not create a Proservora account, you can safely ignore this email.",
        plainText: `Hello ${firstName || "there"},\n\nWelcome to Proservora. Enter this code to confirm your email address: ${code}\n\nThis verification code expires in 10 minutes.\n\nIf you did not create a Proservora account, you can safely ignore this email.\n\nThe Proservora Team`,
      }),
    });

    console.log("Verification email sent successfully:", info.messageId);

    return info;
  } catch (error) {
    console.error("Verification email service error:", {
      message: error.message,
      code: error.code,
      response: error.response,
    });

    throw error;
  }
};

// ============================================================
// SEND PASSWORD RESET EMAIL
// ============================================================

const sendPasswordResetEmail = async (email, code) => {
  try {
    const info = await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: "Reset your Proservora password",
      ...createEmailTemplate({
        eyebrow: "ACCOUNT SECURITY",
        title: "Reset your password",
        greeting: "Hello,",
        intro: "We received a request to reset your Proservora password. Enter the code below to continue.",
        code,
        expiryText: "This password reset code expires in 10 minutes.",
        securityText: "If you did not request a password reset, you can safely ignore this email. Your password will not change.",
        plainText: `Hello,\n\nWe received a request to reset your Proservora password. Enter this code to continue: ${code}\n\nThis password reset code expires in 10 minutes.\n\nIf you did not request a password reset, you can safely ignore this email. Your password will not change.\n\nThe Proservora Team`,
      }),
    });

    console.log("Password reset email sent successfully:", info.messageId);

    return info;
  } catch (error) {
    console.error("Password reset email service error:", {
      message: error.message,
      code: error.code,
      response: error.response,
    });

    const emailError = new Error(
      "Unable to send password reset email"
    );

    emailError.statusCode = 500;

    throw emailError;
  }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  verifyEmailTransport,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOperationalEmail,
};