import { Expo, ExpoPushMessage } from "expo-server-sdk";
import User from "../models/User";

const expo = new Expo();

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

    const messages: ExpoPushMessage[] = [];
    for (const pushToken of tokens) {
      if (!Expo.isExpoPushToken(pushToken)) {
        console.log(`Token ${pushToken} is raw FCM device token or custom token format.`);
      }
      messages.push({
        to: pushToken,
        sound: "default",
        priority: "high",
        channelId: "default",
        title,
        body,
        data: data || {},
        badge: 1,
      });
    }

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        console.log(`Push notifications sent to ${receipts.length} devices.`);
      } catch (error) {
        console.error("Error sending push notification chunk:", error);
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

    const messages: ExpoPushMessage[] = tokens.map((token) => ({
      to: token,
      sound: "default",
      priority: "high",
      channelId: "default",
      title,
      body,
      data: data || {},
    }));

    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      await expo.sendPushNotificationsAsync(chunk);
    }
  } catch (error) {
    console.error("Error sending targeted push notification:", error);
  }
}

