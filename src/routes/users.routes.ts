import express, { Request, Response } from "express";
import mongoose from "mongoose";
import User from "../models/User";
import Chat from "../models/Chat";
import Post from "../models/Post";
import CommunityProfile from "../models/CommunityProfile";
import { login, register } from "../controllers/auth.controller";

const router = express.Router();

import authMiddleware, { AuthRequest } from "../middlewares/auth.middleware";

router.get("/users", async (req: Request, res: Response) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users" });
  }
});

router.post("/register", register);
router.post("/login", login);

router.post(["/push-token", "/users/push-token"], authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== "string") {
      return res.status(400).json({ success: false, message: "pushToken is required" });
    }
    const userId = req.userId || req.user?._id || (req.user as any)?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // Clean up this pushToken from any previous user accounts logged in on this phone
    await User.updateMany(
      { _id: { $ne: userId }, $or: [{ pushToken }, { pushTokens: pushToken }] },
      {
        $unset: { pushToken: 1 },
        $pull: { pushTokens: pushToken },
      }
    );

    await User.findByIdAndUpdate(userId, {
      $set: { pushToken },
      $addToSet: { pushTokens: pushToken },
    });

    return res.status(200).json({ success: true, message: "Push token registered" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Unable to save push token" });
  }
});

// Update current user presence
router.post(["/presence", "/users/presence", "/heartbeat"], authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId || req.user?._id || (req.user as any)?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { status, isOnline: rawIsOnline } = req.body || {};
    let isOnline = true;
    if (status === "inactive" || rawIsOnline === false) {
      isOnline = false;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          isOnline,
          lastActive: new Date(),
        },
      },
      { new: true }
    ).select("isOnline lastActive");

    if (isOnline) {
      void Chat.updateMany(
        { participants: userId, "messages.sender": { $ne: userId }, "messages.isDelivered": false },
        { $set: { "messages.$[elem].isDelivered": true } },
        { arrayFilters: [{ "elem.sender": { $ne: userId }, "elem.isDelivered": false }] }
      ).catch(() => {});
    }

    return res.status(200).json({ success: true, isOnline: updatedUser?.isOnline, lastActive: updatedUser?.lastActive });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Unable to update presence" });
  }
});

// Fetch target user presence status
router.get(["/:userId/presence", "/users/:userId/presence"], authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const targetUser = await User.findById(userId).select("isOnline lastActive");
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const lastActiveTime = targetUser.lastActive ? new Date(targetUser.lastActive).getTime() : 0;
    const now = Date.now();
    // If not updated within last 35 seconds, consider offline
    const isOnline = Boolean(targetUser.isOnline) && now - lastActiveTime < 35000;

    return res.status(200).json({
      success: true,
      isOnline,
      lastActive: targetUser.lastActive,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Unable to fetch user presence" });
  }
});

// Fetch target user public profile & posts
router.get(["/profile/:userId", "/users/profile/:userId"], authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.userId;

    if (!mongoose.isObjectIdOrHexString(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const targetUser = await User.findById(userId)
      .select("fullName username email mobile country city dob profilePhotoUrl coverPhotoUrl role isOnline lastActive createdAt friends friendRequestsSent friendRequestsReceived")
      .lean();

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const communityProfile = await CommunityProfile.findOne({ userId }).lean();

    const currentUser = await User.findById(currentUserId).select("friends friendRequestsSent friendRequestsReceived").lean();
    const isFriend = (currentUser?.friends || []).some((id: any) => String(id) === String(userId));
    const isSent = (currentUser?.friendRequestsSent || []).some((id: any) => String(id) === String(userId));
    const isReceived = (currentUser?.friendRequestsReceived || []).some((id: any) => String(id) === String(userId));

    let friendStatus = "none";
    if (String(currentUserId) === String(userId)) {
      friendStatus = "self";
    } else if (isFriend) {
      friendStatus = "friends";
    } else if (isSent) {
      friendStatus = "request_sent";
    } else if (isReceived) {
      friendStatus = "request_received";
    }

    const currentUserFriendIds = (currentUser?.friends || []).map((id: any) => String(id));
    const targetUserFriendIds = (targetUser.friends || []).map((id: any) => String(id));
    const mutualIds = targetUserFriendIds.filter((id: string) => currentUserFriendIds.includes(id));

    const mutualFriends = mutualIds.length > 0
      ? await User.find({ _id: { $in: mutualIds } })
          .select("fullName username profilePhotoUrl role isOnline lastActive")
          .limit(12)
          .lean()
      : [];

    const lastActiveTime = targetUser.lastActive ? new Date(targetUser.lastActive).getTime() : 0;
    const isOnline = Boolean(targetUser.isOnline) && Date.now() - lastActiveTime < 35000;

    // Fetch posts created by target user
    const posts = await Post.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "fullName username profilePhotoUrl role")
      .lean();

    return res.json({
      success: true,
      profile: {
        _id: targetUser._id,
        fullName: targetUser.fullName,
        username: targetUser.username,
        email: targetUser.email,
        mobile: targetUser.mobile,
        country: targetUser.country || "Pakistan",
        city: targetUser.city || "Karachi",
        dob: targetUser.dob || "",
        profilePhotoUrl: targetUser.profilePhotoUrl,
        coverPhotoUrl: targetUser.coverPhotoUrl || "",
        role: targetUser.role,
        isOnline,
        lastActive: targetUser.lastActive,
        createdAt: targetUser.createdAt,
        friendsCount: (targetUser.friends || []).length,
        mutualFriendsCount: mutualIds.length,
      },
      friendStatus,
      mutualFriends: mutualFriends.map((mf: any) => ({
        _id: mf._id,
        fullName: mf.fullName,
        username: mf.username,
        profilePhotoUrl: mf.profilePhotoUrl,
        role: mf.role,
        isOnline: Boolean(mf.isOnline) && (Date.now() - (mf.lastActive ? new Date(mf.lastActive).getTime() : 0) < 35000),
      })),
      posts: posts.map((p: any) => {
        const mediaArr = Array.isArray(p.media) && p.media.length > 0 ? p.media : p.mediaUrl ? [{ url: p.mediaUrl, type: p.mediaType || "image" }] : [];
        const firstMedia = mediaArr[0];
        const authorObj = p.userId && typeof p.userId === "object" ? p.userId : null;
        return {
          _id: p._id,
          authorName: authorObj?.fullName || targetUser.fullName || "Member",
          authorPhotoUrl: authorObj?.profilePhotoUrl || targetUser.profilePhotoUrl || "",
          text: p.text || p.content || "",
          content: p.text || p.content || "",
          mediaUrl: firstMedia?.url || p.mediaUrl || "",
          mediaType: firstMedia?.type || p.mediaType || "image",
          media: mediaArr,
          createdAt: p.createdAt,
          likesCount: (p.likes || []).length,
          commentsCount: (p.comments || []).length,
          isLiked: (p.likes || []).some((id: any) => String(id) === String(currentUserId)),
        };
      }),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Unable to fetch user profile" });
  }
});

export default router;