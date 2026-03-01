import { getPresignedUploadUrl } from "@/lib/storage/r2-client";
import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import path from "path";
import { workspaceTool } from "../tool-builder/procedures.js";

export function registerStorageTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        workspaceTool(userId)
            .tool("storage_get_upload_url", "Get a presigned URL for uploading a file to object storage", {
                filename: z.string().describe("Original filename"),
                content_type: z.string().describe("MIME type of the file"),
                purpose: z.enum(["image", "audio", "asset", "brand"]).describe(
                    "Purpose of the upload",
                ),
            })
            .meta({ category: "storage", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("storage_get_upload_url", async () => {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substring(7);

                    // Sanitize filename: take only the basename to prevent path traversal
                    const baseName = path.basename(args.filename);
                    // Extract extension and sanitize it (alphanumeric only)
                    const rawExt = baseName.includes(".")
                        ? baseName.split(".").pop() || "bin"
                        : "bin";
                    const extension = rawExt.replace(/[^a-z0-9]/gi, "").toLowerCase();

                    const key = `uploads/${userId}/${args.purpose}/${timestamp}-${random}.${extension}`;

                    const upload_url = await getPresignedUploadUrl(key, args.content_type);

                    return textResult(JSON.stringify({
                        upload_url,
                        r2_key: key,
                        expires_in: 3600,
                    }));
                }, { userId, input: args });
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("storage_register_upload", "Register a completed upload and create a database record", {
                r2_key: z.string().describe("The key returned by storage_get_upload_url"),
                purpose: z.enum(["image", "audio", "asset", "brand"]).describe(
                    "Purpose of the upload",
                ),
                metadata: z.record(z.string(), z.unknown()).optional().describe(
                    "Additional metadata",
                ),
            })
            .meta({ category: "storage", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;
                return safeToolCall("storage_register_upload", async () => {
                    // Ownership check: R2 key must belong to the current user
                    if (!args.r2_key.startsWith(`uploads/${userId}/`)) {
                        throw new Error("Access denied: R2 key does not belong to this user");
                    }

                    const publicUrl = `${process.env.S3_PUBLIC_URL || process.env.CLOUDFLARE_R2_PUBLIC_URL
                        }/${args.r2_key}`;

                    const result = {
                        id: args.r2_key,
                        url: publicUrl,
                        purpose: args.purpose,
                        metadata: args.metadata,
                    };

                    return textResult(JSON.stringify(result));
                }, { userId, input: args });
            })
    );
}
