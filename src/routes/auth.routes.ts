import { Router } from "express";
import multer from "multer";
import { register, login, getMe, updateMe, updateProfilePhoto, listUsers, updateUserRole, removeUser, listCommunityGroups, createCommunityGroup, sendOtp, verifyOtp, resetPassword, checkUsername } from "../controllers/auth.controller";
import { authMiddleware, adminMiddleware, superAdminMiddleware } from "../middlewares/auth.middleware";
import { uploadProfilePhoto } from "../middlewares/upload.middleware";

const router = Router();

const handleProfilePhotoUpload: any = (req: any, res: any, next: any) => {
  uploadProfilePhoto(req, res, (error: any) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" ? "Profile photo must be 5MB or smaller." : error.message;
      res.status(400).json({ success: false, message });
      return;
    }

    res.status(400).json({ success: false, message: error.message || "Unable to upload profile photo." });
  });
};

router.post("/register", register);
router.get("/check-username", checkUsername);
router.post("/check-username", checkUsername);
router.post("/otp/send", sendOtp);
router.post("/otp/verify", verifyOtp);
router.post("/password/reset", resetPassword);
router.post("/login", login);
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.post("/me/photo", authMiddleware, handleProfilePhotoUpload, updateProfilePhoto);
router.get("/users", authMiddleware, adminMiddleware, listUsers);
router.put("/users/:userId/role", authMiddleware, superAdminMiddleware, updateUserRole);
router.delete("/users/:userId", authMiddleware, superAdminMiddleware, removeUser);
router.get("/groups", authMiddleware, listCommunityGroups);
router.post("/groups", authMiddleware, superAdminMiddleware, createCommunityGroup);

export default router;
