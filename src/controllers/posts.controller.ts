import { Response } from "express";
import Post from "../models/Post";
import User from "../models/User";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getMediaUrl } from "../utils/fileUtils";

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "Post text or media is required." });
      }
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const media = files.map((file: any) => ({
      url: getMediaUrl(file.filename),
      type: file.mimetype,
    }));

    const post = await Post.create({
      ...(userId ? { userId } : {}),
      text: text?.trim() || "",
      media,
    });

    const user = userId ? await User.findById(userId).select("fullName").lean() : null;
    const authorName = user?.fullName || "Anonymous user";

    return res.json({
      _id: post._id,
      text: post.text,
      media: post.media || [],
      createdAt: post.createdAt,
      authorName,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to create post." });
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
        media: post.media || [],
        createdAt: post.createdAt,
        authorName,
      };
    });

    return res.json(formattedPosts);
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};
