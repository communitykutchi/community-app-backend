"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.superAdminMiddleware = exports.adminMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const JWT_SECRET = process.env.JWT_SECRET || "secret";
const authMiddleware = async (req, res, next) => {
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
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await User_1.default.findById(payload.id).select("-password");
        req.userId = payload.id;
        req.user = user;
        return next();
    }
    catch (err) {
        req.userId = undefined;
        req.user = undefined;
        return next();
    }
};
exports.authMiddleware = authMiddleware;
const isAdminRole = (role) => ["super_admin", "jamaat_admin", "admin"].includes(role || "");
const isSuperAdminRole = (role) => role === "super_admin" || role === "admin";
const adminMiddleware = (req, res, next) => {
    if (!req.user || !isAdminRole(req.user.role)) {
        return res.status(403).json({ success: false, message: "Admin access required" });
    }
    return next();
};
exports.adminMiddleware = adminMiddleware;
const superAdminMiddleware = (req, res, next) => {
    if (!req.user || !isSuperAdminRole(req.user.role)) {
        return res.status(403).json({ success: false, message: "Super admin access required" });
    }
    return next();
};
exports.superAdminMiddleware = superAdminMiddleware;
exports.default = exports.authMiddleware;
