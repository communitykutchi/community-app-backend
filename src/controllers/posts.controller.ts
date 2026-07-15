import { Response } from "express";
import mongoose from "mongoose";
import Post from "../models/Post";
import User from "../models/User";
import { AuthRequest } from "../middlewares/auth.middleware";
import { uploadBufferToCloudinary } from "../config/cloudinary";

const CLOUDINARY_HOSTS = new Set(["res.cloudinary.com", "cloudinary.com"]);

function getCurrentUserId(req: AuthRequest) {
  const candidate = req.userId || (req.user as any)?._id || req.headers["x-user-id"];
  return candidate ? String(candidate) : "anonymous";
}

export async function removeOrphanPosts() {
  const userIds = (await User.distinct("_id")).map(String);
  await Post.deleteMany({
    $or: [
      { userId: { $exists: false } },
      { userId: null },
      { userId: { $nin: userIds } },
    ],
  });
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

function normalizeRole(role?: string) {
  const normalized = String(role || "").trim().toLowerCase();
  if (["jamaat_admin", "admin", "moderator", "super_admin"].includes(normalized)) {
    return normalized === "super_admin" ? "super_admin" : "moderator";
  }
  return normalized;
}

function isModeratorLikeRole(role?: string) {
  const normalized = normalizeRole(role);
  return ["super_admin", "moderator"].includes(normalized);
}

function isOwnerLikeDelete(post: any, currentUserId?: string) {
  if (!currentUserId) return false;
  const authorId = post?.userId && typeof post.userId === "object" ? String(post.userId._id || "") : post?.userId ? String(post.userId) : "";
  return Boolean(authorId && String(authorId) === String(currentUserId));
}

function serializePost(post: any, currentUserId?: string, requesterRole?: string) {
  const author = typeof post.userId === "object" && post.userId ? post.userId : null;
  const authorId = author?._id ? String(author._id) : post.userId ? String(post.userId) : "";
  const authorName = author ? author.fullName : "Unknown user";
  const authorPhotoUrl = author?.profilePhotoUrl || "";
  const likes = Array.isArray(post.likes) ? post.likes : [];
  const shareUserIds = Array.isArray(post.shareUserIds) ? post.shareUserIds : [];
  const comments = Array.isArray(post.comments) ? post.comments : [];
  const isOwner = Boolean(currentUserId && authorId && authorId === String(currentUserId));
  const canModerate = isModeratorLikeRole(requesterRole);
  const isSuperAdmin = String(requesterRole || "") === "super_admin";
  const canDelete = isOwner || isSuperAdmin || (canModerate && isOwnerLikeDelete(post, currentUserId));

  return {
    _id: post._id,
    text: post.text,
    media: (post.media || []).filter((item: any) => isCloudinaryUrl(item?.url)),
    createdAt: post.createdAt,
    authorName,
    authorPhotoUrl,
    likes: likes.length,
    liked: currentUserId ? likes.includes(currentUserId) : false,
    canDelete,
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
    const requesterRole = String(req.user?.role || "");

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please login to create a post." });
    }

    if (!isModeratorLikeRole(requesterRole)) {
      return res.status(403).json({ success: false, message: "Only super admins and moderators can create posts." });
    }

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
      canDelete: true,
      comments: 0,
      shares: 0,
      commentsList: [],
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to upload media to Cloudinary." });
  }
};

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    const post = await Post.findById(req.params.id).exec();

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found." });
    }

    const isOwner = userId !== "anonymous" && post.userId && String(post.userId) === String(userId);
    const requesterRole = String(req.user?.role || "");
    const canModerate = isModeratorLikeRole(requesterRole);
    const isSuperAdmin = requesterRole === "super_admin";

    if (!isOwner && !canModerate && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: "You can only delete your own posts." });
    }

    if (canModerate && !isOwner && !isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Moderators can only delete their own posts." });
    }

    await Post.findByIdAndDelete(post._id);

    return res.json({ success: true, id: String(post._id) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to delete post." });
  }
};

export const getPosts = async (req: AuthRequest, res: Response) => {
  try {
    await removeOrphanPosts();

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("userId", "fullName profilePhotoUrl")
      .exec();

    const formattedPosts = posts.map((post) => serializePost(post, req.userId, req.user?.role));

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

    return res.json(serializePost(post, userId, req.user?.role));
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

    return res.json(serializePost(post, userId, req.user?.role));
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

    return res.json(serializePost(post, userId, req.user?.role));
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

    return res.json(serializePost(post, userId, req.user?.role));
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || "Unable to add reply." });
  }
};
