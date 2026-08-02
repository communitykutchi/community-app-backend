import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPollOption {
  _id: Types.ObjectId;
  text: string;
  votes: Types.ObjectId[];
}

export interface IPoll extends Document {
  question: string;
  description?: string;
  category?: string;
  options: IPollOption[];
  createdBy: Types.ObjectId;
  expiresAt?: Date;
  isClosed?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const PollOptionSchema = new Schema(
  {
    text: { type: String, required: true, trim: true },
    votes: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { _id: true }
);

const PollSchema = new Schema(
  {
    question: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, default: "General" },
    options: [PollOptionSchema],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date },
    isClosed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IPoll>("Poll", PollSchema);
