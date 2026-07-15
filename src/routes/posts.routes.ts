import express from "express";
import multer from "multer";
import { addComment, addReply, createPost, deletePost, getPosts, sharePost, toggleLikePost } from "../controllers/posts.controller";
import authMiddleware from "../middlewares/auth.middleware";
import uploadMedia from "../middlewares/upload.middleware";

const router = express.Router();

const handleUploadMedia: express.RequestHandler = (req, res, next) => {
  uploadMedia(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "Each media file must be 20MB or smaller." : error.message;
      res.status(400).json({ success: false, message });
      return;
    }

    res.status(400).json({ success: false, message: error.message || "Unable to upload media." });
  });
};

router.post("/create", authMiddleware, handleUploadMedia, createPost);
router.get("/all", authMiddleware, getPosts);
router.delete("/:id", authMiddleware, deletePost);
router.patch("/:id/like", authMiddleware, toggleLikePost);
router.post("/:id/share", authMiddleware, sharePost);
router.post("/:id/comments", authMiddleware, addComment);
router.post("/:id/comments/:commentId/replies", authMiddleware, addReply);

export default router;
