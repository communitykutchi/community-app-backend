"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const posts_controller_1 = require("../controllers/posts.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const router = express_1.default.Router();
router.post("/create", auth_middleware_1.default, upload_middleware_1.default, posts_controller_1.createPost);
router.get("/all", auth_middleware_1.default, posts_controller_1.getPosts);
exports.default = router;
