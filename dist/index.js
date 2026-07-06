"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dns_1 = __importDefault(require("dns"));
dns_1.default.setServers(["8.8.8.8", "8.8.4.4"]);
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = __importDefault(require("./config/db"));
const posts_routes_1 = __importDefault(require("./routes/posts.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const fileUtils_1 = require("./utils/fileUtils");
dotenv_1.default.config();
const app = (0, express_1.default)();
const uploadDir = (0, fileUtils_1.ensureUploadDir)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use("/uploads", express_1.default.static(uploadDir));
// DB Connect
(0, db_1.default)(process.env.MONGO_URI);
// Routes
// app.use("/api/posts", postRoutes);
app.use("/auth", auth_routes_1.default);
app.use("/posts", posts_routes_1.default);
app.use("/api", users_routes_1.default);
app.get("/", (req, res) => {
    res.send("API Running...");
});
app.listen(5000, () => {
    console.log("Server running on http://localhost:5000");
});
