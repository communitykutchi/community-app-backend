import mongoose, { Document, Schema } from "mongoose";

export type ReactionKind = "heart" | "thumbs_up" | "correct" | "wrong";

export interface INotice extends Document {
  title: string;
  body: string;
  author: string;
  createdBy?: mongoose.Types.ObjectId;
  type: "notice" | "mayyat";
  mayyatDetails?: {
    deceasedName?: string;
    relationName?: string;
    age?: string;
    jamaat?: string;
    passedAwayAt?: string;
    funeralPrayerAt?: string;
    funeralPrayerPlace?: string;
    burialPlace?: string;
    notes?: string;
  };
  pinned: boolean;
  reactionEntries: Array<{
    userId: mongoose.Types.ObjectId;
    reaction: ReactionKind;
  }>;
  shareUserIds: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const MayyatDetailsSchema = new Schema(
  {
    deceasedName: { type: String, default: "" },
    relationName: { type: String, default: "" },
    age: { type: String, default: "" },
    jamaat: { type: String, default: "" },
    passedAwayAt: { type: String, default: "" },
    funeralPrayerAt: { type: String, default: "" },
    funeralPrayerPlace: { type: String, default: "" },
    burialPlace: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const NoticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["notice", "mayyat"], default: "notice" },
    mayyatDetails: { type: MayyatDetailsSchema, required: false },
    pinned: { type: Boolean, default: false },
    reactionEntries: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        reaction: {
          type: String,
          enum: ["heart", "thumbs_up", "correct", "wrong"],
          required: true,
        },
      },
    ],
    shareUserIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

NoticeSchema.index({ pinned: -1, createdAt: -1 });

export default mongoose.model<INotice>("Notice", NoticeSchema);
