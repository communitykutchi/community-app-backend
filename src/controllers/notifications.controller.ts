import { Response } from "express";
import Notice from "../models/Notice";
import Post from "../models/Post";
import User from "../models/User";
import { AuthRequest } from "../middlewares/auth.middleware";

import { sendPushNotificationToAll } from "../services/pushNotification.service";

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const [notices, posts] = await Promise.all([
      Notice.find().sort({ createdAt: -1 }).limit(30).lean().exec(),
      Post.find().sort({ createdAt: -1 }).limit(30).populate("userId", "fullName username profilePhotoUrl").lean().exec(),
    ]);

    const noticeNotifications = notices.map((notice: any) => {
      const isMayyat = notice.type === "mayyat";
      const deceasedName = notice.mayyatDetails?.deceasedName || notice.mayyatDetails?.deceasedNameRoman || notice.mayyatDetails?.deceasedNameUrdu || "";
      const title = isMayyat
        ? (deceasedName ? `Mayyat Notification: ${deceasedName}` : "Mayyat Notification")
        : (notice.title || "Community Announcement");
      const subtitle = isMayyat
        ? "إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ - Namaz-e-Janaza details"
        : (notice.body ? notice.body.substring(0, 100) : "");

      return {
        id: `notice-${notice._id}`,
        type: notice.type || "notice",
        title,
        subtitle,
        author: notice.author || "Community Admin",
        createdAt: notice.createdAt,
        targetTab: "notices",
        targetId: String(notice._id),
      };
    });

    const postNotifications = posts.map((post: any) => {
      const author = typeof post.userId === "object" && post.userId ? post.userId : null;
      const authorName = author?.fullName || author?.username || (typeof post.userId === "string" ? "Community Member" : "Community Member");
      const subtitle = post.text ? post.text.substring(0, 100) : (post.media?.length ? "📷 Photo/Video post shared" : "New community post");

      return {
        id: `post-${post._id}`,
        type: "post",
        title: `${authorName} shared a post`,
        subtitle,
        author: authorName,
        createdAt: post.createdAt,
        targetTab: "feed",
        targetId: String(post._id),
      };
    });

    const allNotifications = [...noticeNotifications, ...postNotifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({ success: true, notifications: allNotifications });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to fetch notifications" });
  }
};

export const sendManualNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { title, body, targetTab, targetId } = req.body;
    if (!title || !body) {
      return res.status(400).json({ success: false, message: "Title and body are required." });
    }
    const requesterRole = String(req.user?.role || "");
    if (!["super_admin", "admin", "moderator"].includes(requesterRole)) {
      return res.status(403).json({ success: false, message: "Unauthorized to send push notifications." });
    }

    await sendPushNotificationToAll(String(title).trim(), String(body).trim(), {
      targetTab: targetTab || "home",
      targetId: targetId || "",
    });

    return res.json({ success: true, message: "Push notification sent successfully." });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to send notification" });
  }
};


