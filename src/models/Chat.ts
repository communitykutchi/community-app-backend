import mongoose, { Schema, Document, Types } from "mongoose";

export interface IReplyTo {
  _id?: string;
  text?: string;
  senderName?: string;
}

export interface IMessage {
  _id?: Types.ObjectId;
  sender: Types.ObjectId;
  text?: string;
  audioUrl?: string;
  audioDuration?: number;
  mediaUrl?: string;
  mediaType?: "audio" | "image" | "video" | "document";
  replyTo?: IReplyTo;
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

const ReplyToSchema = new Schema(
  {
    _id: { type: String },
    text: { type: String },
    senderName: { type: String },
  },
  { _id: false }
);

const MessageSchema = new Schema(
  {
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, default: "", trim: true },
    audioUrl: { type: String },
    audioDuration: { type: Number },
    mediaUrl: { type: String },
    mediaType: { type: String, enum: ["audio", "image", "video", "document"] },
    replyTo: { type: ReplyToSchema },
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
