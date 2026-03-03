"use client";

import { useCallback, useRef, useState } from "react";
import { callTool } from "../mcp-client";

export interface UseMcpUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (result: unknown) => void;
  onError?: (error: Error) => void;
}

export function useMcpUpload(
  purpose: "image" | "audio" | "asset" | "brand",
  options: UseMcpUploadOptions = {},
) {
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const [result, setResult] = useState<unknown>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const upload = useCallback(async (file: File, metadata: unknown = {}) => {
    setIsLoading(true);
    setProgress(0);
    setError(undefined);

    try {
      // 1. Get presigned URL
      const presigned = await callTool<{ upload_url: string; r2_key: string; }>(
        "storage_get_upload_url",
        {
          filename: file.name,
          content_type: file.type,
          purpose,
        },
      );
      const { upload_url, r2_key } = presigned;

      // 2. Upload to R2
      const xhr = new XMLHttpRequest();
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            const p = Math.round((event.loaded / event.total) * 100);
            setProgress(p);
            optionsRef.current.onProgress?.(p);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(true);
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));
      });

      xhr.open("PUT", upload_url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.send(file);

      await uploadPromise;

      // 3. Register upload
      const registrationResult = await callTool("storage_register_upload", {
        r2_key,
        purpose,
        metadata,
      });

      setResult(registrationResult);
      optionsRef.current.onSuccess?.(registrationResult);
      return registrationResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      optionsRef.current.onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [purpose]);

  return {
    upload,
    progress,
    isLoading,
    error,
    result,
  };
}
