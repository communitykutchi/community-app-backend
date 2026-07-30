import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import { sendPushNotificationToAll } from "../services/pushNotification.service";

async function testPush() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/community-app";
    await mongoose.connect(mongoUri);
    console.log("Connected to Mongo.");

    console.log("Sending test push notification...");
    await sendPushNotificationToAll("💬 Test Message", "Testing background push notification delivery", { targetTab: "chat" });

    console.log("Done testing.");
    await mongoose.disconnect();
  } catch (err) {
    console.error("Test push error:", err);
  }
}

void testPush();
