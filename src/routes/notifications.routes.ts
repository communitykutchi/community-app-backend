import { Router } from "express";
import { getNotifications, sendManualNotification } from "../controllers/notifications.controller";
import authMiddleware from "../middlewares/auth.middleware";

const router = Router();

router.get("/all", authMiddleware, getNotifications);
router.post("/send", authMiddleware, sendManualNotification);

export default router;
