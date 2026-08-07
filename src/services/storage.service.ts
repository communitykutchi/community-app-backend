import { isR2Configured, uploadToR2, deleteFromR2, getPresignedR2UploadUrl, R2UploadResult } from "../config/r2";
import { uploadBufferToCloudinary } from "../config/cloudinary";

export type StorageCategory = "videos" | "voicemails" | "documents" | "photos" | "general";

export interface UnifiedUploadResult {
  url: string;
  provider: "cloudflare_r2" | "cloudinary" | "fallback";
  key?: string;
  size?: number;
  mimeType: string;
  category: StorageCategory;
}

export const detectStorageCategory = (mimeType: string): StorageCategory => {
  const lowerMime = (mimeType || "").toLowerCase();
  if (lowerMime.startsWith("video/")) return "videos";
  if (lowerMime.startsWith("audio/")) return "voicemails";
  if (
    lowerMime.includes("pdf") ||
    lowerMime.includes("msword") ||
    lowerMime.includes("document") ||
    lowerMime.includes("sheet") ||
    lowerMime.includes("presentation") ||
    lowerMime.includes("zip") ||
    lowerMime.includes("txt")
  ) {
    return "documents";
  }
  if (lowerMime.startsWith("image/")) return "photos";
  return "general";
};

/**
 * Universal Storage Upload Service
 * Directs Videos, Voice Mails, Documents, and Media to Cloudflare R2 when configured,
 * or falls back to Cloudinary gracefully.
 */
export const uploadMediaFile = async (
  buffer: Buffer,
  mimeType: string,
  originalFilename?: string,
  folderName?: string
): Promise<UnifiedUploadResult> => {
  const category = detectStorageCategory(mimeType);
  const targetFolder = folderName || `community-app/${category}`;

  // 1. ALL IMAGES ALWAYS SAVE TO CLOUDINARY
  if (category === "photos") {
    const cResult: any = await uploadBufferToCloudinary(
      { buffer, originalname: originalFilename || "photo" } as any,
      { folder: folderName || "community-app/photos", resourceType: "image" }
    );
    return {
      url: cResult.secure_url || cResult.url,
      provider: "cloudinary",
      key: cResult.public_id,
      mimeType,
      category,
    };
  }

  // 2. Videos, Voice Mails & Documents: Use Cloudflare R2 when configured, or Cloudinary as fallback
  if (isR2Configured()) {
    const r2Result: R2UploadResult = await uploadToR2(buffer, mimeType, targetFolder, originalFilename);
    let publicUrl = r2Result.url;
    
    // If custom domain is not set, generate presigned URL so browser can stream/play audio without 403
    if (!process.env.R2_CUSTOM_DOMAIN && !process.env.R2_PUBLIC_DOMAIN && !process.env.R2_DEV_URL) {
      try {
        const { getPresignedR2DownloadUrl } = await import("../config/r2");
        publicUrl = await getPresignedR2DownloadUrl(r2Result.key, 604800); // 7 days validity
      } catch {
        // Keep default publicUrl if presigned fails
      }
    }

    return {
      url: publicUrl,
      provider: "cloudflare_r2",
      key: r2Result.key,
      size: r2Result.size,
      mimeType,
      category,
    };
  }

  // Fallback to Cloudinary if R2 credentials are not set in .env
  let cResult: any;
  try {
    cResult = await uploadBufferToCloudinary(
      { buffer, originalname: originalFilename || "media" } as any,
      { folder: targetFolder, resourceType: category === "documents" ? "raw" : "auto" }
    );
  } catch (err: any) {
    console.warn("[Storage Service] Cloudinary upload unavailable, saving locally:", err?.message || err);
    const { ensureUploadDir } = await import("../utils/fileUtils");
    const fs = await import("fs");
    const path = await import("path");
    const uploadDir = ensureUploadDir();
    const cleanOrigName = (originalFilename || "voice_note").replace(/[^a-zA-Z0-9._-]/g, "_");
    const filename = `${Date.now()}_${cleanOrigName}`;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);
    const baseUrl = process.env.BACKEND_URL || process.env.API_BASE_URL || "http://localhost:5000";
    cResult = {
      secure_url: `${baseUrl.replace(/\/$/, "")}/uploads/${filename}`,
      public_id: filename,
    };
  }

  return {
    url: cResult.secure_url || cResult.url,
    provider: cResult.public_id?.includes("cloudinary") ? "cloudinary" : "fallback",
    key: cResult.public_id,
    mimeType,
    category,
  };
};

/**
 * Delete File from active storage provider
 */
export const deleteMediaFile = async (keyOrUrl: string, provider: "cloudflare_r2" | "cloudinary" = "cloudflare_r2"): Promise<boolean> => {
  if (provider === "cloudflare_r2" && isR2Configured()) {
    return await deleteFromR2(keyOrUrl);
  }
  return false;
};

/**
 * Direct Client-to-R2 Presigned Upload URL Generator
 */
export const requestR2PresignedUpload = async (filename: string, mimeType: string) => {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not configured in .env. Please set R2 credentials.");
  }

  const category = detectStorageCategory(mimeType);
  const folder = `community-app/${category}`;
  return await getPresignedR2UploadUrl(folder, filename, mimeType, 3600);
};
