"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPosts = exports.createPost = void 0;
const Post_1 = __importDefault(require("../models/Post"));
const createPost = async (req, res) => {
    try {
        const post = await Post_1.default.create(req.body);
        res.json(post);
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
};
exports.createPost = createPost;
const getPosts = async (req, res) => {
    try {
        const posts = await Post_1.default.find().sort({ createdAt: -1 });
        res.json(posts);
    }
    catch (err) {
        res.status(500).json({ error: err });
    }
};
exports.getPosts = getPosts;
