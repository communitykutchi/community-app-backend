import mongoose, { Schema, Document } from "mongoose";

export interface IJob extends Document {
  title: string;
  company: string;
  category: string;
  jobType: string;
  location: string;
  salary?: string;
  description: string;
  requirements?: string[];
  contactEmail?: string;
  contactPhone?: string;
  postedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const JobSchema: Schema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    company: { type: String, required: true, trim: true },
    category: { type: String, required: true, default: "Other" },
    jobType: { type: String, required: true, default: "Full-time" },
    location: { type: String, required: true, trim: true },
    salary: { type: String, default: "" },
    description: { type: String, required: true },
    requirements: [{ type: String }],
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model<IJob>("Job", JobSchema);
