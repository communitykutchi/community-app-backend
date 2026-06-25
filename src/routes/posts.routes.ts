import express from "express";
import { createPost, getPosts } from "../controllers/posts.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/create", authMiddleware, createPost);
router.get("/all", authMiddleware, getPosts);

export default router;
