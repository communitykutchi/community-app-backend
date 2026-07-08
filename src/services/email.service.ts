import { Resend } from "resend";

export type OtpPurpose = "register" | "reset_password";

const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY in .env.");
  }

  return new Resend(apiKey);
};

export const sendOtpEmail = async (email: string, code: string, purpose: OtpPurpose) => {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("EMAIL_FROM is required to send emails.");
  }

  const resend = getResendClient();
  const subject = purpose === "register" ? "Verify your email address" : "Reset your password";
  const text = `Your verification code is ${code}. It expires in 10 minutes.`;

  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    text,
  });

  if (error) {
    throw new Error(error.message || "Unable to send OTP email.");
  }

  return { delivered: true };
};
