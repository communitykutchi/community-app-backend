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

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.userId = undefined;
      return next();
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      req.userId = undefined;
      return next();
    }

    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await User.findById(payload.id).select("-password");

    req.userId = payload.id;
    req.user = user;
    return next();
  } catch (err) {
    req.userId = undefined;
    req.user = undefined;
    return next();
  }
};

const isAdminRole = (role?: string) => ["super_admin", "jamaat_admin", "admin"].includes(role || "");
const isSuperAdminRole = (role?: string) => role === "super_admin" || role === "admin";

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
