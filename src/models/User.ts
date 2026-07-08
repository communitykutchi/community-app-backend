import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  fullName: string;
  fatherName?: string;
  motherName?: string;
  familyMembers?: number;
  cast?: string;
  dob?: string;
  cnic?: string;
  mobile: string;
  email?: string;
  homeStatus: "Owner" | "Rent";
  occupation: "Employee" | "Business Man";
  businessName?: string;
  password: string;
  role: "super_admin" | "jamaat_admin" | "member" | "admin";
  jamaat?: string;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: { type: String, required: true },

    fatherName: { type: String },
    motherName: { type: String },

    familyMembers: { type: Number },

    cast: { type: String },
    dob: { type: String },

    cnic: { type: String },

    mobile: { type: String, required: true, unique: true },

    email: { type: String, unique: true, sparse: true },

    homeStatus: {
      type: String,
      enum: ["Owner", "Rent"],
      default: "Owner",
    },

    occupation: {
      type: String,
      enum: ["Employee", "Business Man"],
      default: "Employee",
    },

    businessName: { type: String },

    password: { type: String, required: true },

    jamaat: { type: String },

    role: {
      type: String,
      enum: ["super_admin", "jamaat_admin", "member", "admin"],
      default: "member",
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", UserSchema);
