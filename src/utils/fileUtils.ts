import fs from "fs";
import path from "path";

const getBaseUrl = () => {
  return process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:5000";
};

export const getUploadDir = () => {
  return path.resolve(__dirname, "../uploads");
};

export const getMediaUrl = (fileName: string) => {
  return `${getBaseUrl()}/uploads/${fileName}`;
};

export const ensureUploadDir = () => {
  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};
