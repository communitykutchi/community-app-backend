import { Response } from "express";
import Post from "../models/Post";
import User from "../models/User";
import { AuthRequest } from "../middlewares/auth.middleware";

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { text } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ success: false, message: "Post text is required." });
    }

    const post = await Post.create({
      userId,
      text: text.trim(),
    });

    const user = await User.findById(userId).select("fullName").lean();
    const authorName = user?.fullName || "Unknown user";

    return res.json({
      _id: post._id,
      text: post.text,
      createdAt: post.createdAt,
      authorName,
    });
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};

export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("userId", "fullName")
      .exec();

    const formattedPosts = posts.map((post) => {
      const authorName = typeof post.userId === "object" && post.userId ? (post.userId as any).fullName : "Unknown user";
      return {
        _id: post._id,
        text: post.text,
        createdAt: post.createdAt,
        authorName,
      };
    });

    return res.json(formattedPosts);
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};
