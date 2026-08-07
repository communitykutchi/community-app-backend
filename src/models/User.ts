import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  username?: string;
  dob?: string;
  cnic?: string;
  mobile?: string;
  email?: string;
  country?: string;
  city?: string;
  profilePhotoUrl?: string;
  profilePhotoPublicId?: string;
  coverPhotoUrl?: string;
  coverPhotoPublicId?: string;
  password: string;
  role: "super_admin" | "moderator" | "member" | "admin";
  pushToken?: string;
  pushTokens?: string[];
  friends?: Types.ObjectId[];
  friendRequestsSent?: Types.ObjectId[];
  friendRequestsReceived?: Types.ObjectId[];
  isOnline?: boolean;
  lastActive?: Date;
  activeSessionId?: string;
  isBanned?: boolean;
  bannedUntil?: Date;
  banDuration?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const normalizeRoleValue = (role?: string) => {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "superadmin" || normalized === "super_admin") return "super_admin";
  if (normalized === "admin") return "admin";
  if (normalized === "mod" || normalized === "moderator") return "moderator";
  if (["super_admin", "admin", "moderator", "member"].includes(normalized)) return normalized as any;
  return "member";
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

    country: { type: String, default: "Pakistan" },
    city: { type: String, default: "Karachi" },

    profilePhotoUrl: { type: String },
    profilePhotoPublicId: { type: String },
    coverPhotoUrl: { type: String },
    coverPhotoPublicId: { type: String },

    password: { type: String, required: true },

    pushToken: { type: String },
    pushTokens: [{ type: String }],
    friends: [{ type: Schema.Types.ObjectId, ref: "User" }],
    friendRequestsSent: [{ type: Schema.Types.ObjectId, ref: "User" }],
    friendRequestsReceived: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isOnline: { type: Boolean, default: false },
    lastActive: { type: Date, default: Date.now },
    activeSessionId: { type: String },
    isBanned: { type: Boolean, default: false },
    bannedUntil: { type: Date },
    banDuration: { type: String },

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
