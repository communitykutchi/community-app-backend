import mongoose, { Schema, Document } from "mongoose";

export interface IPost extends Document {
  userId: string;
  text?: string;
  media?: Array<{ url: string; type?: string }>;
  poll?: {
    question: string;
    options: { text: string; votes: number }[];
  };
  likes: string[];
  shareUserIds: string[];
  comments: {
    userId: string;
    authorName?: string;
    comment: string;
    date: Date;
    replies?: {
      userId: string;
      authorName?: string;
      comment: string;
      date: Date;
    }[];
  }[];
  createdAt: Date;
}

const MediaSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String },
  },
  { _id: false }
);

const PostSchema: Schema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
    media: [MediaSchema],
    poll: {
      question: String,
      options: [
        {
          text: String,
          votes: { type: Number, default: 0 },
        },
      ],
    },
    likes: [{ type: String }],
    shareUserIds: [{ type: String }],
    comments: [
      {
        userId: String,
        authorName: String,
        comment: String,
        date: { type: Date, default: Date.now },
        replies: [
          {
            userId: String,
            authorName: String,
            comment: String,
            date: { type: Date, default: Date.now },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IPost>("Post", PostSchema);
