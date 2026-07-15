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
    const fallbackHeader = typeof req.headers["x-user-id"] === "string" ? req.headers["x-user-id"] : undefined;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : undefined;

    if (!token && !fallbackHeader) {
      req.userId = undefined;
      req.user = undefined;
      return next();
    }

    if (!token && fallbackHeader) {
      req.userId = String(fallbackHeader);
      const user = await User.findById(req.userId).select("-password");
      req.user = user;
      return next();
    }

    const payload = jwt.verify(token as string, JWT_SECRET) as { id?: string; _id?: string };
    const resolvedUserId = payload.id || payload._id;

    if (!resolvedUserId) {
      req.userId = undefined;
      req.user = undefined;
      return next();
    }

    const user = await User.findById(resolvedUserId).select("-password");

    req.userId = String(resolvedUserId);
    req.user = user;
    return next();
  } catch (err) {
    req.userId = undefined;
    req.user = undefined;
    return next();
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
