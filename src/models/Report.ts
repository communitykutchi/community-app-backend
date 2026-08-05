import mongoose, { Schema, Document } from "mongoose";

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId;
  reporterName: string;
  targetType: "post" | "notice" | "poll" | "job" | "user";
  targetId?: string;
  reason: string;
  status: "pending" | "resolved" | "dismissed";
  createdAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reporterName: { type: String, required: true },
    targetType: { type: String, enum: ["post", "notice", "poll", "job", "user"], required: true },
    targetId: { type: String },
    reason: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved", "dismissed"], default: "pending" },
  },
  { timestamps: true }
);

export const Report = mongoose.model<IReport>("Report", ReportSchema);
