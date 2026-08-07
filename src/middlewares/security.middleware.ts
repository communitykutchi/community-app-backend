import { Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// 1. Helmet Security Middleware (Configured for mobile & web apps)
export const securityHeaders = helmet({
  contentSecurityPolicy: false, // Allows media assets from Cloudinary/CDN
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// 2. Global API Rate Limiter (3000 requests per 15 minutes per IP to support polling & real-time features)
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || req.path === "/",
  message: {
    success: false,
    code: "TOO_MANY_REQUESTS",
    message: "Too many requests from this IP. Please try again after 15 minutes.",
  },
});

// 3. Auth Brute-Force Rate Limiter (Skipping session checks & polling routes)
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.method === "OPTIONS" ||
    req.path === "/me" ||
    req.path === "/check-username" ||
    req.path === "/users" ||
    req.path === "/groups" ||
    req.path === "/analytics" ||
    req.path === "/reports",
  message: {
    success: false,
    code: "TOO_MANY_AUTH_ATTEMPTS",
    message: "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

// Helper: Recursively sanitize NoSQL injection operators ($ and .)
function sanitizeValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    // Strip malicious script tags for XSS protection
    return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").trim();
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }
  if (typeof value === "object") {
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      // Reject NoSQL operator keys starting with $ or containing .
      if (key.startsWith("$") || key.includes(".")) {
        continue;
      }
      cleanObj[key] = sanitizeValue(value[key]);
    }
    return cleanObj;
  }
  return value;
}

// 4. NoSQL & XSS Sanitization Middleware
export const sanitizeInputMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.body) req.body = sanitizeValue(req.body);
    if (req.query) req.query = sanitizeValue(req.query);
    if (req.params) req.params = sanitizeValue(req.params);
    next();
  } catch {
    next();
  }
};
