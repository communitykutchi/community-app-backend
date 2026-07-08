import mongoose, { Schema, Document } from "mongoose";

export interface ICommunityGroup extends Document {
  name: string;
  createdBy?: string;
}

const CommunityGroupSchema = new Schema<ICommunityGroup>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    createdBy: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model<ICommunityGroup>("CommunityGroup", CommunityGroupSchema);
