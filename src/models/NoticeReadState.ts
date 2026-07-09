import mongoose, { Document, Schema } from "mongoose";

export interface INoticeReadState extends Document {
  userId: mongoose.Types.ObjectId;
  lastReadAt: Date;
}

const NoticeReadStateSchema = new Schema<INoticeReadState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lastReadAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model<INoticeReadState>("NoticeReadState", NoticeReadStateSchema);
