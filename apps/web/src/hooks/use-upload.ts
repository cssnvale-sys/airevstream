'use client';

import { useState, useCallback } from 'react';
import { getToken } from '@/lib/auth';

export interface UploadResult {
  bucket: string;
  key: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

interface PresignedResponse {
  success: boolean;
  data: {
    url: string;
    bucket: string;
    key: string;
    expiresIn: number;
  };
}

export function useUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File, bucket: string): Promise<UploadResult> => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Step 1: Get presigned URL from our API
      const token = getToken();
      const presignedRes = await fetch('/api/v1/upload/presigned-put', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          bucket,
          fileName: file.name,
          contentType: file.type,
        }),
      });

      if (!presignedRes.ok) {
        let msg = 'Failed to get upload URL';
        try {
          const errData = await presignedRes.json();
          msg = errData.error?.message ?? msg;
        } catch {
          // Response was not JSON — use default message
        }
        throw new Error(msg);
      }

      const presigned: PresignedResponse = await presignedRes.json();
      const { url, key } = presigned.data;

      // Step 2: Upload file directly to MinIO via presigned PUT URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(100);
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to a network error'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });

        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      const result: UploadResult = {
        bucket,
        key,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      };

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      console.error('useUpload error:', err);
      setError(message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
  }, []);

  return { upload, uploading, progress, error, reset };
}
