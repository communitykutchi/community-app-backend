import express, { Request, Response } from "express";
import User from "../models/User";
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

    await User.findByIdAndUpdate(userId, {
      $set: { pushToken },
      $addToSet: { pushTokens: pushToken },
    });

    return res.status(200).json({ success: true, message: "Push token registered" });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message || "Unable to save push token" });
  }
});

export default router;