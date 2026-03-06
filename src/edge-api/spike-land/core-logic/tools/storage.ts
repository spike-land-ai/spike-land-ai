/**
 * Storage Tools (CF Workers)
 *
 * Provides MCP tools for deploying SPA assets to R2 using content-hash diffing.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { textResult, jsonResult, McpError, McpErrorCode } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

const CONTENT_TYPE_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json",
  ".wasm": "application/wasm",
};

function getContentType(key: string): string {
  const extMatch = key.match(/\.[^.]+$/);
  const ext = extMatch ? extMatch[0].toLowerCase() : "";
  return CONTENT_TYPE_MAP[ext] || "application/octet-stream";
}

export function registerStorageTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
  spaAssets?: R2Bucket,
): void {
  const t = freeTool(userId, db);

  const diffTool = t
    .tool(
      "storage_manifest_diff",
      "Pre-flight diff: send keys + SHA-256 hashes, get back which files actually need uploading. Avoids sending unchanged file contents.",
      {
        files: z
          .array(
            z.object({
              key: z.string(),
              sha256: z.string(),
              size: z.number().optional(),
            }),
          )
          .min(1)
          .max(500),
      },
    )
    .meta({ category: "storage", tier: "workspace", stability: "stable" })
    .handler(async ({ input }) => {
      if (!spaAssets) {
        return textResult("R2 not configured (SPA_ASSETS binding missing).");
      }

      const results = await Promise.allSettled(
        input.files.map(async (file) => {
          const head = await spaAssets.head(file.key);
          if (!head) {
            return { key: file.key, reason: "missing" };
          }
          if (!head.checksums?.sha256) {
            return { key: file.key, reason: "no_checksum" };
          }
          const storedSha256 =
            head.checksums.sha256 instanceof ArrayBuffer
              ? Array.from(new Uint8Array(head.checksums.sha256))
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join("")
              : head.checksums.sha256;

          if (storedSha256.toLowerCase() !== file.sha256.toLowerCase()) {
            return { key: file.key, reason: "hash_mismatch" };
          }
          return null; // No upload needed
        }),
      );

      const toUpload: { key: string; reason: string }[] = [];
      const errors: { key: string; error: string }[] = [];

      results.forEach((res, index: number) => {
        const file = input.files[index];
        if (res.status === "rejected") {
          errors.push({ key: file.key, error: String(res.reason) });
        } else if (res.value) {
          toUpload.push(res.value);
        }
      });

      return jsonResult("Diff complete", {
        toUpload,
        errors,
        unchangedCount: input.files.length - toUpload.length - errors.length,
      });
    });
  
  (diffTool as unknown as { requiredRole?: string }).requiredRole = "admin";
  registry.registerBuilt(diffTool);

  const uploadTool = t
    .tool(
      "storage_upload_batch",
      "Upload multiple files in one call. Use storage_manifest_diff first to only send changed files. Validates SHA-256 server-side before R2 put.",
      {
        files: z
          .array(
            z.object({
              key: z.string(),
              content_base64: z.string(),
              content_type: z.string().optional(),
              sha256: z.string(),
            }),
          )
          .min(1)
          .max(50),
      },
    )
    .meta({ category: "storage", tier: "workspace", stability: "stable" })
    .handler(async ({ input }) => {
      if (!spaAssets) {
        return textResult("R2 not configured (SPA_ASSETS binding missing).");
      }

      let totalSize = 0;
      const decodedFiles = input.files.map((f) => {
        // Convert base64 to Uint8Array
        const binaryString = atob(f.content_base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        totalSize += bytes.byteLength;
        if (bytes.byteLength > 5 * 1024 * 1024) {
          throw new McpError(`File ${f.key} exceeds 5MB limit`, McpErrorCode.INVALID_INPUT);
        }
        return { ...f, bytes };
      });

      if (totalSize > 25 * 1024 * 1024) {
        throw new McpError(`Batch exceeds 25MB total size limit`, McpErrorCode.INVALID_INPUT);
      }

      const results = await Promise.allSettled(
        decodedFiles.map(async (file) => {
          // Verify SHA-256 before uploading
          const hashBuffer = await crypto.subtle.digest("SHA-256", file.bytes);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const calculatedSha256 = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

          if (calculatedSha256.toLowerCase() !== file.sha256.toLowerCase()) {
            throw new McpError(`SHA-256 mismatch for ${file.key}`, McpErrorCode.INVALID_INPUT);
          }

          const contentType = file.content_type || getContentType(file.key);

          await spaAssets.put(file.key, file.bytes, {
            sha256: calculatedSha256,
            httpMetadata: { contentType },
          });
          return file.key;
        }),
      );

      const successes: string[] = [];
      const errors: { key: string; error: string }[] = [];

      results.forEach((res, index: number) => {
        const file = input.files[index];
        if (res.status === "rejected") {
          errors.push({ key: file.key, error: String(res.reason) });
        } else {
          successes.push(res.value);
        }
      });

      if (errors.length > 0 && successes.length === 0) {
        throw new McpError(
          `All uploads failed: ${JSON.stringify(errors)}`,
          McpErrorCode.R2_UPLOAD_ERROR,
        );
      }

      return jsonResult("Upload complete", { successes, errors });
    });

  (uploadTool as unknown as { requiredRole?: string }).requiredRole = "admin";
  registry.registerBuilt(uploadTool);

  const listTool = t
    .tool(
      "storage_list",
      "List deployed assets in R2 (with prefix/cursor) for verification and rollback inspection.",
      {
        prefix: z.string().optional(),
        limit: z.number().max(1000).optional(),
        cursor: z.string().optional(),
      },
    )
    .meta({ category: "storage", tier: "workspace", stability: "stable" })
    .handler(async ({ input }) => {
      if (!spaAssets) {
        return textResult("R2 not configured (SPA_ASSETS binding missing).");
      }

      const listResult = await spaAssets.list({
        prefix: input.prefix,
        limit: input.limit,
        cursor: input.cursor,
      });

      return jsonResult("List complete", {
        objects: listResult.objects.map((o) => ({
          key: o.key,
          size: o.size,
          etag: o.etag,
          uploaded: o.uploaded,
        })),
        truncated: listResult.truncated,
        cursor: listResult.truncated ? listResult.cursor : undefined,
      });
    });

  (listTool as unknown as { requiredRole?: string }).requiredRole = "admin";
  registry.registerBuilt(listTool);
}
