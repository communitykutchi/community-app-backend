import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMessage {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  isDelivered?: boolean;
  isRead?: boolean;
  deletedFor?: Types.ObjectId[];
  isDeletedForEveryone?: boolean;
  createdAt?: Date;
}

export interface IChat extends Document {
  participants: Types.ObjectId[];
  messages: IMessage[];
  createdAt?: Date;
  updatedAt?: Date;
}

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    isDelivered: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isDeletedForEveryone: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ChatSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
    messages: [MessageSchema],
  },
  { timestamps: true }
);

export default mongoose.model<IChat>("Chat", ChatSchema);
