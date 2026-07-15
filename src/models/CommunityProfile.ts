import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICommunityProfile extends Document {
  userId: Types.ObjectId | string;
  fatherName?: string;
  motherName?: string;
  jamaat?: string;
  cast?: string;
  familyMembers?: number;
  homeStatus: "Owner" | "Rent";
  occupation: "Employee" | "Business Man";
  businessName?: string;
}

const CommunityProfileSchema = new Schema<ICommunityProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },
    jamaat: { type: String, trim: true },
    cast: { type: String, trim: true },
    familyMembers: { type: Number },
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
    businessName: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model<ICommunityProfile>("CommunityProfile", CommunityProfileSchema);
