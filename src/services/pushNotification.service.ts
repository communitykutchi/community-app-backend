import { Expo, ExpoPushMessage } from "expo-server-sdk";
import User from "../models/User";

const expo = new Expo();

async function sendRawFcmNotification(pushToken: string, title: string, body: string, data?: Record<string, any>) {
  try {
    const fcmServerKey = process.env.FCM_SERVER_KEY || "AIzaSyA1gQdY4LTxWRzRQmmJfOHdcAfwtQi6JRo";
    const payload = {
      to: pushToken,
      priority: "high",
      content_available: true,
      notification: {
        title,
        body,
        sound: "default",
        badge: 1,
        channel_id: "default",
        android_channel_id: "default",
      },
      data: {
        ...(data || {}),
        title,
        body,
      },
    };

    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `key=${fcmServerKey}`,
      },
      body: JSON.stringify(payload),
    });

    const resText = await res.text();
    console.log(`Raw FCM push status (${pushToken.substring(0, 15)}...):`, res.status, resText);
  } catch (err: any) {
    console.error("Error sending raw FCM notification:", err?.message || err);
  }
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

    for (const pushToken of tokens) {
      if (Expo.isExpoPushToken(pushToken)) {
        expoMessages.push({
          to: pushToken,
          sound: "default",
          priority: "high",
          channelId: "default",
          title,
          body,
          data: data || {},
          badge: 1,
        });
      } else {
        rawFcmTokens.push(pushToken);
      }
    }

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        try {
          const receipts = await expo.sendPushNotificationsAsync(chunk);
          console.log(`Expo push notifications sent to ${receipts.length} devices.`);
        } catch (error) {
          console.error("Error sending push notification chunk:", error);
        }
      }
    }

    if (rawFcmTokens.length > 0) {
      console.log(`Sending direct FCM notifications to ${rawFcmTokens.length} raw FCM device tokens...`);
      for (const fcmToken of rawFcmTokens) {
        void sendRawFcmNotification(fcmToken, title, body, data);
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

    for (const pushToken of tokens) {
      if (Expo.isExpoPushToken(pushToken)) {
        expoMessages.push({
          to: pushToken,
          sound: "default",
          priority: "high",
          channelId: "default",
          title,
          body,
          data: data || {},
          badge: 1,
        });
      } else {
        rawFcmTokens.push(pushToken);
      }
    }

    if (expoMessages.length > 0) {
      const chunks = expo.chunkPushNotifications(expoMessages);
      for (const chunk of chunks) {
        await expo.sendPushNotificationsAsync(chunk);
      }
    }

    if (rawFcmTokens.length > 0) {
      for (const fcmToken of rawFcmTokens) {
        void sendRawFcmNotification(fcmToken, title, body, data);
      }
    }
  } catch (error) {
    console.error("Error sending targeted push notification:", error);
  }
}

