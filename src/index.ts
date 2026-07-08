import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db";
import postRoutes from "./routes/posts.routes";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/users.routes";
import { ensureUploadDir } from "./utils/fileUtils";


dotenv.config();

const app = express();
const uploadDir = ensureUploadDir();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));

// DB Connect
connectDB(process.env.MONGO_URI!);

// Routes
// app.use("/api/posts", postRoutes);
app.use("/auth", authRoutes);
app.use("/posts", postRoutes);
app.use("/api", userRoutes);

app.get("/", (req, res) => {
  res.send("API Running...");
});

const PORT = Number(process.env.PORT) || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
