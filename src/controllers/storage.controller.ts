import { Request, Response } from "express";
import { isR2Configured } from "../config/r2";
import { uploadMediaFile, requestR2PresignedUpload } from "../services/storage.service";

/**
 * Controller to upload any media file (Video, Voice Mail, Document, Photo) to Cloudflare R2 / Storage
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file provided for upload." });
    }

    const customFolder = req.body.folder || undefined;
    const result = await uploadMediaFile(file.buffer, file.mimetype, file.originalname, customFolder);

    return res.status(200).json({
      success: true,
      message: `File uploaded successfully to ${result.provider === "cloudflare_r2" ? "Cloudflare R2" : "Storage"}.`,
      file: {
        url: result.url,
        key: result.key,
        provider: result.provider,
        category: result.category,
        mimeType: result.mimeType,
        originalName: file.originalname,
        size: file.size,
      },
    });
  } catch (error: any) {
    console.error("[Storage Controller] Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to upload file to storage.",
    });
  }
};

/**
 * Controller to generate a presigned R2 upload URL for large files / 4K videos direct client upload
 */
export const getPresignedUploadUrl = async (req: Request, res: Response) => {
  try {
    const { filename, mimeType } = req.body;
    if (!filename || !mimeType) {
      return res.status(400).json({ success: false, message: "filename and mimeType are required." });
    }

    const result = await requestR2PresignedUpload(filename, mimeType);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      message: error.message || "Unable to generate presigned upload URL.",
    });
  }
};

/**
 * Check Storage & Cloudflare R2 Status
 */
export const getStorageStatus = async (req: Request, res: Response) => {
  const r2Active = isR2Configured();
  return res.status(200).json({
    success: true,
    storage: {
      r2Configured: r2Active,
      activeProvider: r2Active ? "Cloudflare R2 Storage" : "Cloudinary Storage Fallback",
      bucketName: process.env.R2_BUCKET_NAME || null,
      customDomain: process.env.R2_CUSTOM_DOMAIN || process.env.R2_PUBLIC_DOMAIN || null,
      supportedCategories: ["videos", "voicemails", "documents", "photos", "general"],
    },
  });
};
