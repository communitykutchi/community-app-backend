import { Router } from "express";
import {
  createNotice,
  deleteNotice,
  getNotices,
  getUnreadNoticeCount,
  markNoticesRead,
  reactToNotice,
  shareNotice,
  togglePinNotice,
  updateNotice,
} from "../controllers/notices.controller";
import authMiddleware, { adminMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/all", authMiddleware, getNotices);
router.get("/unread-count", authMiddleware, getUnreadNoticeCount);
router.post("/mark-read", authMiddleware, markNoticesRead);
router.post("/create", authMiddleware, adminMiddleware, createNotice);
router.put("/:id", authMiddleware, adminMiddleware, updateNotice);
router.delete("/:id", authMiddleware, adminMiddleware, deleteNotice);
router.patch("/:id/pin", authMiddleware, adminMiddleware, togglePinNotice);
router.patch("/:id/react", authMiddleware, reactToNotice);
router.post("/:id/share", authMiddleware, shareNotice);

export default router;
