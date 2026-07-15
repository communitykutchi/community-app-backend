import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  username?: string;
  dob?: string;
  cnic?: string;
  mobile?: string;
  email?: string;
  profilePhotoUrl?: string;
  profilePhotoPublicId?: string;
  password: string;
  role: "super_admin" | "moderator" | "member" | "admin";
}

const normalizeRoleValue = (role?: string) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "jamaat_admin") return "moderator";
  if (normalized === "jamaat-admin") return "moderator";
  if (normalized === "superadmin" || normalized === "super_admin") return "super_admin";
  if (normalized === "mod" || normalized === "moderator") return "moderator";
  if (normalized === "admin") return "admin";
  return normalized || "member";
};

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },

    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
    },

    dob: { type: String },

    cnic: { type: String },

    mobile: { type: String, unique: true, sparse: true },

    email: { type: String, unique: true, sparse: true },

    profilePhotoUrl: { type: String },
    profilePhotoPublicId: { type: String },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["super_admin", "moderator", "member", "admin"],
      default: "member",
      set: normalizeRoleValue,
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
