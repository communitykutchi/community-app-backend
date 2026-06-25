import mongoose, { Schema, Document } from "mongoose";

export interface IPost extends Document {
  userId: string;
  text?: string;
  images?: string[];
  video?: string;
  poll?: {
    question: string;
    options: { text: string; votes: number }[];
  };
  likes: string[];
  comments: {
    userId: string;
    comment: string;
    date: Date;
  }[];
  createdAt: Date;
}

const PostSchema: Schema = new Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: String,
    images: [String],
    video: String,
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
    comments: [
      {
        userId: String,
        comment: String,
        date: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model<IPost>("Post", PostSchema);
