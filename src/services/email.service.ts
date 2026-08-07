import { Resend } from "resend";

export type OtpPurpose = "register" | "reset_password";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY in .env.");
  }

  return new Resend(apiKey);
};

// Permanent public Cloudinary CDN URL for Kutchi Community Logo
const CLOUDINARY_LOGO_URL = "https://res.cloudinary.com/cqfvme2o/image/upload/v1786082269/community-app/assets/app_logo.png";

export const sendOtpEmail = async (email: string, code: string, purpose: OtpPurpose) => {
  const defaultFrom = "Kutchi Community <noreply@kutchicommunity.com>";
  let rawFrom = (process.env.EMAIL_FROM || defaultFrom).trim();
  
  // Remove outer quotes if present in .env
  rawFrom = rawFrom.replace(/^["']|["']$/g, "").trim();

  // Ensure format follows "email@example.com" or "Name <email@example.com>"
  let formattedFrom = defaultFrom;
  if (rawFrom.includes("<") && rawFrom.endsWith(">")) {
    formattedFrom = rawFrom;
  } else if (rawFrom.includes("@")) {
    formattedFrom = `Kutchi Community <${rawFrom}>`;
  }

  const resend = getResendClient();
  const isRegister = purpose === "register";
  const subject = isRegister 
    ? `🔒 ${code} is your Kutchi Community Verification Code`
    : `🔑 ${code} is your Password Reset Code`;

  const logoUrl = process.env.APP_LOGO_URL || CLOUDINARY_LOGO_URL;
  const currentYear = new Date().getFullYear();

  const title = isRegister ? "Verify Your Email Address" : "Reset Account Password";
  const badgeText = isRegister ? "ACCOUNT VERIFICATION" : "SECURITY CODE";
  const leadText = isRegister
    ? "Thank you for joining <strong>Kutchi Community</strong>. Please use the 6-digit verification code below to complete your registration."
    : "We received a request to reset your <strong>Kutchi Community</strong> account password. Use the verification code below to proceed.";

  const text = `Your verification code is ${code}. It expires in 10 minutes.`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 30px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #0d9488 100%); padding: 32px 24px; text-align: center;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" align="center" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="padding-bottom: 12px;">
                    <img src="${logoUrl}" alt="Kutchi Community Logo" width="68" height="68" style="display: block; width: 68px; height: 68px; object-fit: cover; border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.3); padding: 0; margin: 0 auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);" />
                  </td>
                </tr>
              </table>
              <span style="display: inline-block; background-color: rgba(45, 212, 191, 0.2); border: 1px solid rgba(45, 212, 191, 0.4); color: #5eead4; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; padding: 4px 12px; border-radius: 100px; margin-bottom: 8px;">
                ${badgeText}
              </span>
              <h1 style="color: #ffffff; font-size: 22px; font-weight: 800; margin: 8px 0 0 0; letter-spacing: -0.5px;">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td style="padding: 32px 28px; background-color: #ffffff;">
              <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello,
              </p>
              <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                ${leadText}
              </p>

              <!-- Distinct OTP Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(180deg, #f0fdfa 0%, #ccfbf1 100%); border: 2px dashed #0d9488; border-radius: 16px; margin: 24px 0; text-align: center;">
                <tr>
                  <td style="padding: 24px 16px;">
                    <span style="display: block; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #0f766e; margin-bottom: 10px;">
                      Your Verification Code
                    </span>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 900; letter-spacing: 12px; color: #0d9488; text-indent: 12px; line-height: 1.2; margin: 8px 0;">
                      ${code}
                    </div>
                    <p style="margin: 12px 0 0 0; font-size: 12px; color: #475569; font-weight: 600;">
                      ⏰ Code expires in <strong style="color: #0f766e;">10 minutes</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Warning -->
              <div style="background-color: #f8fafc; border-left: 4px solid #0d9488; padding: 12px 16px; border-radius: 0 10px 10px 0; margin-top: 24px;">
                <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0;">
                  🔒 <strong>Security Tip:</strong> Never share this code with anyone. Kutchi Community team members will never ask for your verification code.
                </p>
              </div>

              <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 24px 0 0 0;">
                If you did not request this code, you can safely ignore this email. Someone may have mistyped their email address.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; font-weight: 600; margin: 0 0 6px 0;">
                Kutchi Community Portal
              </p>
              <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                © ${currentYear} Kutchi Community. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const { error } = await resend.emails.send({
    from: formattedFrom,
    to: email,
    subject,
    text,
    html,
  });

  if (error) {
    throw new Error(error.message || "Unable to send OTP email.");
  }

  return { delivered: true };
};
