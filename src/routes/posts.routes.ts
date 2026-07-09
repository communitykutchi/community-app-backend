import express from "express";
import { addComment, addReply, createPost, getPosts, sharePost, toggleLikePost } from "../controllers/posts.controller";
import authMiddleware from "../middlewares/auth.middleware";
import uploadMedia from "../middlewares/upload.middleware";

const router = express.Router();

router.post("/create", authMiddleware, uploadMedia, createPost);
router.get("/all", authMiddleware, getPosts);
router.patch("/:id/like", authMiddleware, toggleLikePost);
router.post("/:id/share", authMiddleware, sharePost);
router.post("/:id/comments", authMiddleware, addComment);
router.post("/:id/comments/:commentId/replies", authMiddleware, addReply);

export default router;
