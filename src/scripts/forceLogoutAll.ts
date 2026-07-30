import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db";
import User from "../models/User";

dotenv.config();

async function forceLogoutAll() {
  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/community";
  console.log("Connecting to MongoDB to force logout all users...");
  await connectDB(mongoUri);

  const users = await User.find();
  console.log(`Found ${users.length} users. Invalidating all active sessions...`);

  let count = 0;
  for (const user of users) {
    user.activeSessionId = new mongoose.Types.ObjectId().toString();
    user.isOnline = false;
    user.pushToken = undefined;
    await user.save();
    count++;
  }

  console.log(`Successfully forced logout for all ${count} users across all devices!`);
  await mongoose.disconnect();
  process.exit(0);
}

forceLogoutAll().catch((err) => {
  console.error("Error executing force logout:", err);
  process.exit(1);
});
