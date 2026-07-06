"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMedia = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fileUtils_1 = require("../utils/fileUtils");
const uploadDir = (0, fileUtils_1.ensureUploadDir)();
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
        cb(null, uniqueName);
    },
});
const fileFilter = (_req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
        cb(null, true);
        return;
    }
    cb(new Error("Only image and video files are allowed."));
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 20 * 1024 * 1024 },
});
exports.uploadMedia = upload.array("media", 5);
exports.default = exports.uploadMedia;
