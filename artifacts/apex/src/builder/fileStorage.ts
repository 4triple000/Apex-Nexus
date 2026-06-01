/**
 * Apex File Storage
 * Client-side utility for uploading files via presigned URLs.
 * Talks to /api/storage/uploads/request-url → PUT to GCS presigned URL.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface UploadedFile {
  objectKey:   string;
  name:        string;
  contentType: string;
  size:        number;
  publicUrl:   string;
  uploadedAt:  number;
}

export interface UploadProgress {
  loaded:  number;
  total:   number;
  percent: number;
}

/**
 * Upload a file using the Replit Object Storage presigned URL flow.
 * Returns the stored file metadata.
 */
export async function uploadFile(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<UploadedFile> {
  // Step 1: Request presigned URL
  const reqRes = await fetch(`${BASE}/api/storage/uploads/request-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:        file.name,
      size:        file.size,
      contentType: file.type || "application/octet-stream",
    }),
  });

  if (!reqRes.ok) {
    const err = await reqRes.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to get upload URL");
  }

  const { uploadURL, objectKey } = await reqRes.json() as { uploadURL: string; objectKey: string };

  // Step 2: PUT file bytes directly to GCS presigned URL (XHR for progress tracking)
  await uploadWithProgress(file, uploadURL, onProgress);

  const publicUrl = `${BASE}/api/storage/objects/${objectKey}`;

  return {
    objectKey,
    name:        file.name,
    contentType: file.type || "application/octet-stream",
    size:        file.size,
    publicUrl,
    uploadedAt:  Date.now(),
  };
}

function uploadWithProgress(
  file: File,
  url: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress({ loaded: e.loaded, total: e.total, percent: Math.round((e.loaded / e.total) * 100) });
        }
      };
    }

    xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`));
    xhr.onerror = () => reject(new Error("Upload network error"));
    xhr.send(file);
  });
}

/** Check accepted file types for different upload contexts */
export const ACCEPT_TYPES = {
  image:    "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  video:    "video/mp4,video/webm,video/ogg",
  audio:    "audio/mpeg,audio/wav,audio/ogg,audio/webm",
  document: ".pdf,.doc,.docx,.txt,.md",
  any:      "*",
} as const;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824)  return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(1)} GB`;
}
