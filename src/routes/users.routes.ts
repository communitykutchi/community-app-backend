import express, { Request, Response } from "express";
import User from "../models/User";
import Chat from "../models/Chat";
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

export default router;