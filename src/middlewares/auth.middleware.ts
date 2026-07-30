import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";

export interface AuthRequest extends Request {
  userId?: string;
  user?: any;
}

const JWT_SECRET = process.env.JWT_SECRET || "secret";

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Authentication token is missing",
      });
    }

    const payload = jwt.verify(token as string, JWT_SECRET) as { id?: string; _id?: string; activeSessionId?: string };
    const resolvedUserId = payload.id || payload._id;

    if (!resolvedUserId) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(resolvedUserId).select("-password");
    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    if (!payload.activeSessionId || !user.activeSessionId || user.activeSessionId !== payload.activeSessionId) {
      return res.status(401).json({
        success: false,
        code: "ACCOUNT_LOGGED_IN_ELSEWHERE",
        message: "Your account was logged in on another device. You have been logged out automatically.",
      });
    }

    req.userId = String(resolvedUserId);
    req.user = user;
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      message: "Session expired or invalid token.",
    });
  }
};

const isAdminRole = (role?: string) => ["super_admin", "jamaat_admin", "moderator", "admin"].includes(role || "");
const isSuperAdminRole = (role?: string) => ["super_admin", "admin"].includes(role || "");

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !isAdminRole(req.user.role)) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  return next();
};

export const superAdminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !isSuperAdminRole(req.user.role)) {
    return res.status(403).json({ success: false, message: "Super admin access required" });
  }

  return next();
};

export default authMiddleware;
