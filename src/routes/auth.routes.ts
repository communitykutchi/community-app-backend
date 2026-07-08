import { Router } from "express";
import { register, login, getMe, listUsers, updateUserRole, removeUser, listCommunityGroups, createCommunityGroup, sendOtp, verifyOtp, resetPassword } from "../controllers/auth.controller";
import { authMiddleware, adminMiddleware, superAdminMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/otp/send", sendOtp);
router.post("/otp/verify", verifyOtp);
router.post("/password/reset", resetPassword);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.get("/users", authMiddleware, adminMiddleware, listUsers);
router.put("/users/:userId/role", authMiddleware, superAdminMiddleware, updateUserRole);
router.delete("/users/:userId", authMiddleware, superAdminMiddleware, removeUser);
router.get("/groups", authMiddleware, listCommunityGroups);
router.post("/groups", authMiddleware, superAdminMiddleware, createCommunityGroup);

export default router;