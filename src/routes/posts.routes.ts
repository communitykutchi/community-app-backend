import express from "express";
import { createPost, getPosts } from "../controllers/posts.controller";
import authMiddleware from "../middlewares/auth.middleware";
import uploadMedia from "../middlewares/upload.middleware";

const router = express.Router();

router.post("/create", authMiddleware, uploadMedia, createPost);
router.get("/all", authMiddleware, getPosts);

export default router;
