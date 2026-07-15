import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import postRoutes from "./routes/posts.routes";
import { removeOrphanPosts } from "./controllers/posts.controller";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import noticeRoutes from "./routes/notices.routes";


dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/community';

  await connectDB(mongoUri);
  await removeOrphanPosts();

  app.get("/", (req, res) => {
    res.send("API Running...");
  });

  app.use("/auth", authRoutes);
  app.use("/posts", postRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/notices", noticeRoutes);
  app.use("/api/notices", noticeRoutes);
  app.use("/api", userRoutes);

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
