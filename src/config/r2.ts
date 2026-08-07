import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface R2UploadResult {
  url: string;
  key: string;
  bucket: string;
  size: number;
  mimeType: string;
}

export const isR2Configured = (): boolean => {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  return Boolean(accountId && accessKeyId && secretAccessKey && bucketName);
};

export const getR2Client = (): S3Client => {
  const accountId = process.env.R2_ACCOUNT_ID || "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "";
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accessKeyId || !secretAccessKey || (!accountId && !endpoint)) {
    throw new Error("Cloudflare R2 credentials missing. Please set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY in .env.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

export const getR2PublicUrl = (key: string): string => {
  const customDomain = process.env.R2_CUSTOM_DOMAIN || process.env.R2_PUBLIC_DOMAIN || process.env.R2_DEV_URL;
  if (customDomain) {
    const cleanDomain = customDomain.replace(/\/$/, "");
    return `${cleanDomain}/${key}`;
  }

  const bucketName = process.env.R2_BUCKET_NAME || "";
  const accountId = process.env.R2_ACCOUNT_ID || "";
  if (bucketName && accountId) {
    return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
  }

  const endpoint = process.env.R2_ENDPOINT || "";
  if (endpoint && bucketName) {
    return `${endpoint.replace(/\/$/, "")}/${bucketName}/${key}`;
  }

  return `/${key}`;
};

/**
 * Upload Buffer directly to Cloudflare R2 Bucket
 * Supports Videos, Voice Mails / Audio Clips, Documents (PDF/DOCX), and Images
 */
export const uploadToR2 = async (
  buffer: Buffer,
  mimeType: string,
  folder = "general",
  customFilename?: string
): Promise<R2UploadResult> => {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "";
  
  const timestamp = Date.now();
  const cleanFolder = folder.replace(/^\/|\/$/g, "");
  const extension = mimeType.split("/")[1] || "bin";
  const filename = customFilename
    ? `${timestamp}_${customFilename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    : `${timestamp}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
    
  const key = cleanFolder ? `${cleanFolder}/${filename}` : filename;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);
  const publicUrl = getR2PublicUrl(key);

  return {
    url: publicUrl,
    key,
    bucket,
    size: buffer.length,
    mimeType,
  };
};

/**
 * Delete File from Cloudflare R2 Bucket
 */
export const deleteFromR2 = async (key: string): Promise<boolean> => {
  if (!isR2Configured() || !key) return false;

  try {
    const client = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME || "";

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error("[R2 Storage] Delete Error:", error);
    return false;
  }
};

/**
 * Presigned Upload URL for Direct High-Speed Client-to-R2 Uploads (Ideal for 4K Videos)
 */
export const getPresignedR2UploadUrl = async (
  folder = "videos",
  filename: string,
  mimeType: string,
  expiresInSeconds = 3600
) => {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "";
  const key = `${folder}/${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  const finalPublicUrl = getR2PublicUrl(key);

  return {
    uploadUrl,
    finalPublicUrl,
    key,
    expiresInSeconds,
  };
};

/**
 * Presigned Download URL for Secure Private Documents / Confidential Voice Notes
 */
export const getPresignedR2DownloadUrl = async (key: string, expiresInSeconds = 3600) => {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME || "";

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
};
