import { Router } from "express";
import multer from "multer";
import { uploadFile, getPresignedUploadUrl, getStorageStatus } from "../controllers/storage.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Multer memory storage configuration (Supports Videos up to 100MB, Voice Mails, PDFs, Images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max for direct buffer upload
  },
});

router.get("/status", getStorageStatus);
router.post("/upload", authMiddleware, upload.single("file"), uploadFile);
router.post("/presigned-url", authMiddleware, getPresignedUploadUrl);

export default router;
