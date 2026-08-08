import mongoose, { Schema, Document } from "mongoose";

export interface IWorkerReview {
  _id?: string;
  userId?: mongoose.Types.ObjectId;
  userName: string;
  userPhotoUrl?: string;
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface IWorker extends Document {
  title: string;
  company: string; // Worker / Master Name
  category: string;
  jobType: string;
  location: string;
  salary?: string;
  description: string;
  requirements?: string[];
  contactEmail?: string;
  contactPhone?: string;
  hasWhatsApp?: boolean;
  postedBy?: mongoose.Types.ObjectId;
  reviews?: IWorkerReview[];
  averageRating?: number;
  totalReviews?: number;
  createdAt: Date;
}

const ReviewSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  userName: { type: String, required: true },
  userPhotoUrl: { type: String, default: "" },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

const WorkerSchema: Schema = new Schema(
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
    hasWhatsApp: { type: Boolean, default: true },
    postedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviews: [ReviewSchema],
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IWorker>("Worker", WorkerSchema);
