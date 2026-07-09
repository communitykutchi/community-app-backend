import { Response } from "express";
import mongoose from "mongoose";
import Post from "../models/Post";
import User from "../models/User";
import { AuthRequest } from "../middlewares/auth.middleware";
import { uploadBufferToCloudinary } from "../config/cloudinary";

const CLOUDINARY_HOSTS = new Set(["res.cloudinary.com", "cloudinary.com"]);

function getCurrentUserId(req: AuthRequest) {
  return req.userId || "anonymous";
}

function isCloudinaryUrl(url?: string) {
  if (!url) return false;

  try {
    const parsedUrl = new URL(url);
    return CLOUDINARY_HOSTS.has(parsedUrl.hostname) || parsedUrl.hostname.endsWith(".cloudinary.com");
  } catch {
    return false;
  }
}

function serializePost(post: any, currentUserId?: string) {
  const author = typeof post.userId === "object" && post.userId ? post.userId : null;
  const authorName = author ? author.fullName : "Unknown user";
  const authorPhotoUrl = author?.profilePhotoUrl || "";
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const shareUserIds = Array.isArray(post.shareUserIds) ? post.shareUserIds : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];

  return {
    _id: post._id,
    text: post.text,
    media: (post.media || []).filter((item: any) => isCloudinaryUrl(item?.url)),
    createdAt: post.createdAt,
    authorName,
    authorPhotoUrl,
    likes: likes.length,
    liked: currentUserId ? likes.includes(currentUserId) : false,
    comments: comments.length,
    shares: shareUserIds.length,
    commentsList: comments.map((comment: any) => ({
      id: String(comment._id),
      text: comment.comment,
      author: comment.authorName || "Anonymous user",
      authorPhotoUrl: comment.authorPhotoUrl || "",
      replies: (comment.replies || []).map((reply: any) => ({
        id: String(reply._id),
        text: reply.comment,
        author: reply.authorName || "Anonymous user",
        authorPhotoUrl: reply.authorPhotoUrl || "",
        replyTo: comment.authorName || "Anonymous user",
      })),
    })),
  };
}

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { text } = req.body;

    if (!text || typeof text !== "string" || !text.trim()) {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ success: false, message: "Post text or media is required." });
      }
    }

    const files = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    const uploadedMedia = await Promise.all(files.map((file) => uploadBufferToCloudinary(file)));
    const media = uploadedMedia.map((uploadResult, index) => ({
      url: uploadResult.secure_url,
      type: files[index]?.mimetype || uploadResult.resource_type,
    }));

    const post = await Post.create({
      ...(userId ? { userId } : {}),
      text: text?.trim() || "",
      media,
    });

    const user = userId ? await User.findById(userId).select("fullName profilePhotoUrl").lean() : null;
    const authorName = user?.fullName || "Anonymous user";
    const authorPhotoUrl = user?.profilePhotoUrl || "";

    return res.json({
      _id: post._id,
      text: post.text,
      media,
      createdAt: post.createdAt,
      authorName,
      authorPhotoUrl,
      likes: 0,
      liked: false,
      comments: 0,
      shares: 0,
      commentsList: [],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to upload media to Cloudinary." });
  }
};

export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("userId", "fullName profilePhotoUrl")
      .exec();

    const formattedPosts = posts.map((post) => serializePost(post, req.userId));

    return res.json(formattedPosts);
  } catch (err) {
    return res.status(500).json({ error: err });
  }
};

export const toggleLikePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const post = await Post.findById(req.params.id).populate("userId", "fullName profilePhotoUrl").exec();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const likes = post.likes || [];
    if (likes.includes(userId)) {
      post.likes = likes.filter((id) => id !== userId);
    } else {
      post.likes = [...likes, userId];
    }

    await post.save();
    await post.populate("userId", "fullName profilePhotoUrl");

    return res.json(serializePost(post, userId));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to update like." });
  }
};

export const sharePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const post = await Post.findById(req.params.id).populate("userId", "fullName profilePhotoUrl").exec();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const shareUserIds = post.shareUserIds || [];
    post.shareUserIds = [...shareUserIds, `${userId}:${Date.now()}`];

    await post.save();
    await post.populate("userId", "fullName profilePhotoUrl");

    return res.json(serializePost(post, userId));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to share post." });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      return res.status(400).json({ success: false, message: "Comment text is required." });
    }

    const post = await Post.findById(req.params.id).populate("userId", "fullName profilePhotoUrl").exec();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    post.comments.push({
      userId,
      authorName: req.user?.fullName || "Anonymous user",
      authorPhotoUrl: req.user?.profilePhotoUrl || "",
      comment: text,
      date: new Date(),
      replies: [],
    });

    await post.save();
    await post.populate("userId", "fullName profilePhotoUrl");

    return res.json(serializePost(post, userId));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to add comment." });
  }
};

export const addReply = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";

    if (!text) {
      return res.status(400).json({ success: false, message: "Reply text is required." });
    }

    const post = await Post.findById(req.params.id).populate("userId", "fullName profilePhotoUrl").exec();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const comment = (post.comments as any).id(new mongoose.Types.ObjectId(req.params.commentId));
    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found." });
    }

    comment.replies = comment.replies || [];
    comment.replies.push({
      userId,
      authorName: req.user?.fullName || "Anonymous user",
      authorPhotoUrl: req.user?.profilePhotoUrl || "",
      comment: text,
      date: new Date(),
    });

    await post.save();
    await post.populate("userId", "fullName profilePhotoUrl");

    return res.json(serializePost(post, userId));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to add reply." });
  }
};
