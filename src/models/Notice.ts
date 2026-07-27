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
    fatherName?: string;
    relation?: string;
    relationName?: string;
    funeralPrayerDayPart?: string;
    funeralPrayerTime?: string;
    funeralPrayerPlace?: string;
    notes?: string;

    // Legacy fields
    age?: string;
    jamaat?: string;
    passedAwayAt?: string;
    burialPlace?: string;
    deceasedNameRoman?: string;
    deceasedNameUrdu?: string;
    fatherNameRoman?: string;
    fatherNameUrdu?: string;
    relationRoman?: string;
    relationUrdu?: string;
    dayPartRoman?: string;
    dayPartUrdu?: string;
    time?: string;
    janazaLocation?: string;
    funeralPrayerAt?: string;
  };
  romanNotice?: string;
  urduNotice?: string;
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
    fatherName: { type: String, default: "" },
    relation: { type: String, default: "" },
    relationName: { type: String, default: "" },
    funeralPrayerDayPart: { type: String, default: "" },
    funeralPrayerTime: { type: String, default: "" },
    funeralPrayerPlace: { type: String, default: "" },
    notes: { type: String, default: "" },

    age: { type: String, default: "" },
    jamaat: { type: String, default: "" },
    passedAwayAt: { type: String, default: "" },
    burialPlace: { type: String, default: "" },
    deceasedNameRoman: { type: String, default: "" },
    deceasedNameUrdu: { type: String, default: "" },
    fatherNameRoman: { type: String, default: "" },
    fatherNameUrdu: { type: String, default: "" },
    relationRoman: { type: String, default: "" },
    relationUrdu: { type: String, default: "" },
    dayPartRoman: { type: String, default: "" },
    dayPartUrdu: { type: String, default: "" },
    time: { type: String, default: "" },
    janazaLocation: { type: String, default: "" },
  },
  { _id: false, strict: false }
);

const NoticeSchema = new Schema<INotice>(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["notice", "mayyat"], default: "notice" },
    mayyatDetails: { type: MayyatDetailsSchema, required: false },
    romanNotice: { type: String, default: "" },
    urduNotice: { type: String, default: "" },
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
