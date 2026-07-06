"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUploadDir = exports.getMediaUrl = exports.getUploadDir = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const getBaseUrl = () => {
    return process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:5000";
};
const getUploadDir = () => {
    return path_1.default.resolve(__dirname, "../uploads");
};
exports.getUploadDir = getUploadDir;
const getMediaUrl = (fileName) => {
    return `${getBaseUrl()}/uploads/${fileName}`;
};
exports.getMediaUrl = getMediaUrl;
const ensureUploadDir = () => {
    const uploadDir = (0, exports.getUploadDir)();
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    return uploadDir;
};
exports.ensureUploadDir = ensureUploadDir;
