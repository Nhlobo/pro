/**
 * Resumable, chunked uploads to Supabase Storage via the TUS protocol.
 *
 * - Uses 6 MB chunks (Supabase requirement).
 * - Automatically resumes from the last completed chunk if the connection drops.
 * - Falls back to a plain `supabase.storage.from(bucket).upload(...)` call for
 *   small files where the resumable overhead isn't worth it.
 *
 * Usage:
 *   await uploadFileResumable({
 *     bucket: 'documents',
 *     path: 'reports/foo.pdf',
 *     file,
 *     upsert: true,
 *     onProgress: (pct) => setProgress(pct),
 *   });
 */
import * as tus from "tus-js-client";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://zybkhhxvsdjkluqydcbb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp5YmtoaHh2c2Rqa2x1cXlkY2JiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MzYzNzgsImV4cCI6MjA3MDUxMjM3OH0.63RLvxgywnkjnqHzr9OLNxB_6wVpOBtcGlQZvJR_HyQ";

// Supabase TUS implementation requires exactly 6 MB chunks (except the last).
const CHUNK_SIZE = 6 * 1024 * 1024;
// Below this size resumable adds round-trips without meaningful benefit.
const RESUMABLE_THRESHOLD = 6 * 1024 * 1024;

export interface ResumableUploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  onProgress?: (percent: number, bytesSent: number, bytesTotal: number) => void;
  signal?: AbortSignal;
}

export interface ResumableUploadResult {
  path: string;
  resumed: boolean;
}

export async function uploadFileResumable(
  opts: ResumableUploadOptions,
): Promise<ResumableUploadResult> {
  const {
    bucket,
    path,
    file,
    contentType,
    cacheControl = "3600",
    upsert = true,
    onProgress,
    signal,
  } = opts;

  const size = (file as File).size ?? 0;
  const type =
    contentType ?? (file as File).type ?? "application/octet-stream";

  // Small file → use the standard one-shot upload. Faster, fewer round-trips.
  if (size < RESUMABLE_THRESHOLD) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: type,
      cacheControl,
      upsert,
    });
    if (error) throw error;
    onProgress?.(100, size, size);
    return { path, resumed: false };
  }

  // Prefer the signed-in user's token so RLS still applies; fall back to anon.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token ?? SUPABASE_ANON_KEY;

  return await new Promise<ResumableUploadResult>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        "x-upsert": upsert ? "true" : "false",
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: bucket,
        objectName: path,
        contentType: type,
        cacheControl,
      },
      chunkSize: CHUNK_SIZE,
      onError: (err) => reject(err),
      onProgress: (bytesSent, bytesTotal) => {
        const pct = bytesTotal ? (bytesSent / bytesTotal) * 100 : 0;
        onProgress?.(pct, bytesSent, bytesTotal);
      },
      onSuccess: () => resolve({ path, resumed: false }),
    });

    if (signal) {
      const onAbort = () => {
        upload.abort(true).catch(() => {});
        reject(new DOMException("Upload aborted", "AbortError"));
      };
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }

    // Resume from any previous unfinished upload of this file (same fingerprint).
    upload.findPreviousUploads().then((prev) => {
      if (prev.length > 0) {
        upload.resumeFromPreviousUpload(prev[0]);
      }
      upload.start();
    });
  });
}
