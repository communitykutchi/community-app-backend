import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { initializeApp, cert, App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import User from "../models/User";
import Chat from "../models/Chat";

const expo = new Expo();

import fs from "fs";
import path from "path";

// Initialize Firebase Admin SDK for FCM
let firebaseApp: App | null = null;
try {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (serviceAccountJson) {
    const serviceAccount = typeof serviceAccountJson === "string" && serviceAccountJson.trim().startsWith("{") 
      ? JSON.parse(serviceAccountJson) 
      : serviceAccountJson;
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully with FIREBASE_SERVICE_ACCOUNT env var.");
  } else if (serviceAccountBase64) {
    const decoded = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(decoded);
    firebaseApp = initializeApp({
      credential: cert(serviceAccount),
    });
    console.log("Firebase Admin SDK initialized successfully with FIREBASE_SERVICE_ACCOUNT_BASE64 env var.");
  } else {
    let serviceAccount: any = null;
    try {
      serviceAccount = require("../config/service-account.json");
    } catch {
      try {
        const configDir = path.join(__dirname, "../config");
        const files = fs.readdirSync(configDir);
        const adminSdkFile = files.find((f) => f.includes("firebase-adminsdk") && f.endsWith(".json"));
        if (adminSdkFile) {
          serviceAccount = require(path.join(configDir, adminSdkFile));
        }
      } catch {}
    }

    if (serviceAccount) {
      firebaseApp = initializeApp({
        credential: cert(serviceAccount),
      });
      console.log("Firebase Admin SDK initialized successfully with local service account JSON.");
    } else {
      console.log("Firebase Admin SDK: No service-account.json or FIREBASE_SERVICE_ACCOUNT env key found. Direct FCM v1 requires a service account key.");
    }
  }
} catch (err: any) {
  console.log("Firebase Admin initialization notice:", err?.message || err);
}


async function sendFcmMulticast(tokens: string[], title: string, body: string, data?: Record<string, any>): Promise<boolean> {
  if (!firebaseApp || tokens.length === 0) return false;
  try {
    const stringData: Record<string, string> = {
      title,
      body,
    };
    if (data) {
      Object.keys(data).forEach((key) => {
        stringData[key] = String(data[key]);
      });
    }

    const imageUrl = data?.imageUrl ? String(data.imageUrl) : undefined;

    const message: any = {
      tokens,
      notification: {
        title,
        body,
        ...(imageUrl ? { imageUrl } : {}),
      },
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "default",
          priority: "max",
          defaultSound: true,
          defaultVibrateTimings: true,
          icon: "ic_launcher",
          color: "#0d9488",
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
        ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
      },
      data: stringData,
    };

    const messaging = getMessaging(firebaseApp);
    const response = await messaging.sendEachForMulticast(message);
    console.log(`Firebase FCM multicast sent to ${tokens.length} devices. Success: ${response.successCount}, Failure: ${response.failureCount}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const failedToken = tokens[idx];
          const errCode = resp.error?.code;
          console.log(`FCM token notice (${failedToken.substring(0, 15)}...):`, errCode || resp.error?.message);
          if (errCode === "messaging/registration-token-not-registered" || errCode === "messaging/invalid-registration-token") {
            User.updateMany(
              { $or: [{ pushToken: failedToken }, { pushTokens: failedToken }] },
              {
                $unset: { pushToken: 1 },
                $pull: { pushTokens: failedToken },
              }
            ).catch(() => {});
          }
        }
      });
    }

    return response.successCount > 0;
  } catch (err: any) {
    console.log("Firebase FCM multicast notice (falling back to FCM HTTP API):", err?.message || err);
    return false;
  }
}


async function sendRawFcmNotification(pushToken: string, title: string, body: string, data?: Record<string, any>) {
  if (firebaseApp) {
    const success = await sendFcmMulticast([pushToken], title, body, data);
    if (success) return;
  }
  console.log(`Notice: FCM token (${pushToken.substring(0, 15)}...) requires Firebase Admin SDK service account key for direct FCM v1 delivery.`);
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const users = await User.find({
      $or: [
        { pushToken: { $exists: true, $ne: "" } },
        { pushTokens: { $exists: true, $not: { $size: 0 } } },
      ],
    })
      .select("pushToken pushTokens")
      .lean();

    const pushTokensSet = new Set<string>();
    users.forEach((u: any) => {
      if (u.pushToken && u.pushToken.trim()) pushTokensSet.add(u.pushToken.trim());
      if (Array.isArray(u.pushTokens)) {
        u.pushTokens.forEach((t: string) => {
          if (t && t.trim()) pushTokensSet.add(t.trim());
        });
      }
    });

    const tokens = Array.from(pushTokensSet);
    if (tokens.length === 0) {
      console.log("No push tokens stored yet in database.");
      return;
    }

    const expoMessages: ExpoPushMessage[] = [];
    const rawFcmTokens: string[] = [];

    for (const rawToken of tokens) {
      const pushToken = String(rawToken || "").trim();
      if (!pushToken) continue;
      
      if (pushToken.startsWith("ExponentPushToken") || pushToken.startsWith("ExpoPushToken")) {
        expoMessages.push({
          to: pushToken,
          sound: "default",
          priority: "high",
          channelId: "default",
          title,
          body,
          data: data || {},
          badge: 1,
          icon: "./assets/icon.png",
          color: "#0d9488",
          _displayInForeground: true,
        } as any);
      } else {
        rawFcmTokens.push(pushToken);
      }
    }

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          console.log(`Expo push notifications sent to ${receipts.length} devices:`, JSON.stringify(receipts));
        } catch (error) {
          console.error("Error sending push notification chunk:", error);
        }
      }
    }

    if (rawFcmTokens.length > 0) {
      console.log(`Sending direct FCM notifications to ${rawFcmTokens.length} raw FCM device tokens...`);
      for (const fcmToken of rawFcmTokens) {
        await sendRawFcmNotification(fcmToken, title, body, data);
      }
    }
  } catch (error) {
    console.error("Error broadcasting push notifications:", error);
  }
}

export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
) {
  try {
    const user = await User.findById(userId).select("pushToken pushTokens").lean();
    if (!user) return;

    const pushTokensSet = new Set<string>();
    if (user.pushToken && user.pushToken.trim()) pushTokensSet.add(user.pushToken.trim());
    if (Array.isArray(user.pushTokens)) {
      user.pushTokens.forEach((t: string) => {
        if (t && t.trim()) pushTokensSet.add(t.trim());
      });
    }

    const tokens = Array.from(pushTokensSet);
    if (tokens.length === 0) return;

    const expoMessages: ExpoPushMessage[] = [];
    const rawFcmTokens: string[] = [];

    for (const rawToken of tokens) {
      const pushToken = String(rawToken || "").trim();
      if (!pushToken) continue;

      if (pushToken.startsWith("ExponentPushToken") || pushToken.startsWith("ExpoPushToken")) {
        expoMessages.push({
          to: pushToken,
          sound: "default",
          priority: "high",
          channelId: "default",
          title,
          body,
          data: data || {},
          badge: 1,
          icon: "./assets/icon.png",
          color: "#0d9488",
          _displayInForeground: true,
        } as any);
      } else {
        rawFcmTokens.push(pushToken);
      }
    }

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          console.log(`Expo targeted push notification sent:`, JSON.stringify(receipts));
        } catch (err) {
          console.error("Targeted Expo push error:", err);
        }
      }
    }

    if (rawFcmTokens.length > 0) {
      for (const fcmToken of rawFcmTokens) {
        await sendRawFcmNotification(fcmToken, title, body, data);
      }
    }

    // Mark chat messages as delivered in background when push notification is sent to recipient
    if (data?.targetTab === "chat" || data?.chatId) {
      const recipientObjectId = userId;
      if (data.chatId) {
        await Chat.updateOne(
          { _id: data.chatId },
          { $set: { "messages.$[elem].isDelivered": true } },
          { arrayFilters: [{ "elem.sender": { $ne: recipientObjectId }, "elem.isDelivered": false }] }
        ).catch(() => {});
      } else {
        await Chat.updateMany(
          { participants: recipientObjectId, "messages.sender": { $ne: recipientObjectId }, "messages.isDelivered": false },
          { $set: { "messages.$[elem].isDelivered": true } },
          { arrayFilters: [{ "elem.sender": { $ne: recipientObjectId }, "elem.isDelivered": false }] }
        ).catch(() => {});
      }
    }
  } catch (error) {
    console.error("Error sending targeted push notification:", error);
  }
}

