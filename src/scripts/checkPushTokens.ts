import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/User";

async function checkPushTokens() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/community-app";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const users = await User.find({}).select("fullName email mobile pushToken pushTokens isOnline lastActive").lean();
    console.log("\n--- USER PUSH TOKENS IN DB ---");
    users.forEach((u) => {
      console.log(`User: ${u.fullName} (${u.email || u.mobile || "no-contact"})`);
      console.log(`  pushToken: ${u.pushToken || "NONE"}`);
      console.log(`  pushTokens: ${JSON.stringify(u.pushTokens || [])}`);
      console.log(`  isOnline: ${u.isOnline}, lastActive: ${u.lastActive}`);
    });
    console.log("-------------------------------\n");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

void checkPushTokens();
