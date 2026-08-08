import mongoose, { Schema, Document } from "mongoose";

export interface IOtp extends Document {
  email: string;
  code: string;
  purpose: "register" | "reset_password" | "change_email";
  expiresAt: Date;
  used: boolean;
}

const OtpSchema = new Schema<IOtp>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ["register", "reset_password", "change_email"], required: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
  },
  { timestamps: true }
);

OtpSchema.index({ email: 1, purpose: 1 });

export default mongoose.model<IOtp>("Otp", OtpSchema);
