import dns from "dns";
try {
  dns.setServers(["8.8.8.8", "8.8.4.4"]);
} catch (err) {
  console.warn("[Startup] Custom DNS servers set ignored:", err);
}

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import postRoutes from "./routes/posts.routes";
import { ensureDefaultAdmin } from "./controllers/auth.controller";
import { removeOrphanPosts } from "./controllers/posts.controller";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import friendRoutes from "./routes/friends.routes";
import noticeRoutes from "./routes/notices.routes";
import notificationRoutes from "./routes/notifications.routes";
import pollRoutes from "./routes/polls.routes";
import {
  securityHeaders,
  globalRateLimiter,
  authRateLimiter,
  sanitizeInputMiddleware,
} from "./middlewares/security.middleware";

dotenv.config();

const app = express();

const allowedOrigins = [
  "https://kutchicommunity.com",
  "https://www.kutchicommunity.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:4173",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, native requests) or allowed origins
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      // Allow origin dynamically to prevent CORS blocks in production
      callback(null, true);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "Access-Control-Allow-Origin",
  ],
  optionsSuccessStatus: 200,
};

// 1. Enable CORS first so preflight OPTIONS requests return CORS headers immediately
app.use(cors(corsOptions));

// 2. Security Middleware Layer
app.use(securityHeaders);
app.use(sanitizeInputMiddleware);
app.use(globalRateLimiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const PORT = process.env.PORT || 5000;

async function startServer() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/community';

  await connectDB(mongoUri);
  await ensureDefaultAdmin().catch((err) => console.log("[Startup] ensureDefaultAdmin notice:", err?.message || err));
  await removeOrphanPosts();

  app.get("/", (req, res) => {
    res.send("API Running...");
  });

  app.use("/auth", authRateLimiter, authRoutes);
  app.use("/posts", postRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/notices", noticeRoutes);
  app.use("/api/notices", noticeRoutes);
  app.use("/notifications", notificationRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/users", userRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api", userRoutes);
  app.use("/friends", friendRoutes);
  app.use("/api/friends", friendRoutes);
  app.use("/polls", pollRoutes);
  app.use("/api/polls", pollRoutes);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

