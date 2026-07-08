import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import connectDB from "./config/db";
import postRoutes from "./routes/posts.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import { ensureUploadDir } from "./utils/fileUtils";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

ensureUploadDir();
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

connectDB(process.env.MONGO_URI!);

app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/api", userRoutes);

app.get("/", (_req, res) => {
  res.send("API Running...");
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
