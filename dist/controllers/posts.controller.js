"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosts = exports.createPost = void 0;
const Post_1 = __importDefault(require("../models/Post"));
const User_1 = __importDefault(require("../models/User"));
const fileUtils_1 = require("../utils/fileUtils");
const createPost = async (req, res) => {
    try {
        const userId = req.userId;
        const { text } = req.body;
        if (!text || typeof text !== "string" || !text.trim()) {
            if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
                return res.status(400).json({ success: false, message: "Post text or media is required." });
            }
        }
        const files = Array.isArray(req.files) ? req.files : [];
        const media = files.map((file) => ({
            url: (0, fileUtils_1.getMediaUrl)(file.filename),
            type: file.mimetype,
        }));
        const post = await Post_1.default.create({
            ...(userId ? { userId } : {}),
            text: text?.trim() || "",
            media,
        });
        const user = userId ? await User_1.default.findById(userId).select("fullName").lean() : null;
        const authorName = user?.fullName || "Anonymous user";
        return res.json({
            _id: post._id,
            text: post.text,
            media: post.media || [],
            createdAt: post.createdAt,
            authorName,
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, message: err.message || "Unable to create post." });
    }
};
exports.createPost = createPost;
const getPosts = async (req, res) => {
    try {
        const posts = await Post_1.default.find()
            .sort({ createdAt: -1 })
            .populate("userId", "fullName")
            .exec();
        const formattedPosts = posts.map((post) => {
            const authorName = typeof post.userId === "object" && post.userId ? post.userId.fullName : "Unknown user";
            return {
                _id: post._id,
                text: post.text,
                media: post.media || [],
                createdAt: post.createdAt,
                authorName,
            };
        });
        return res.json(formattedPosts);
    }
    catch (err) {
        return res.status(500).json({ error: err });
    }
};
exports.getPosts = getPosts;
