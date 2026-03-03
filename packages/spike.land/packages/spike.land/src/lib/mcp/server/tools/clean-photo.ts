/**
 * CleanSweep Photo Tools (Server-Side)
 *
 * MCP tool for photo analysis: validation and metadata extraction.
 * Buffer is never stored — only parsed in-memory.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

export function registerCleanPhotoTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "clean_photo_analyze",
    description:
      "Analyze a photo for CleanSweep: validates EXIF data, timestamp freshness, screenshot detection, and extracts metadata (camera model, timestamp, software). Buffer is never stored.",
    category: "clean-photo",
    tier: "free",
    inputSchema: {
      photo_base64: z
        .string()
        .min(1)
        .describe("Base64-encoded photo data (JPEG preferred)"),
    },
    handler: async ({
      photo_base64,
    }: {
      photo_base64: string;
    }): Promise<CallToolResult> => {
      return safeToolCall("clean_photo_analyze", async () => {
        const { validatePhoto, extractPhotoMetadata } = await import(
          "@/lib/clean/photo-validation"
        );

        const validation = validatePhoto(photo_base64);
        const meta = extractPhotoMetadata(photo_base64);

        let text = `**Photo Analysis**\n\n`;

        text += `### Validation\n`;
        text += `- **Valid:** ${validation.valid ? "Yes" : "No"}\n`;
        text += `- **Screenshot detected:** ${validation.isScreenshot ? "Yes" : "No"}\n`;
        if (validation.ageSeconds !== null) {
          text += `- **Age:** ${validation.ageSeconds} seconds\n`;
        }
        if (validation.cameraModel) {
          text += `- **Camera:** ${validation.cameraModel}\n`;
        }
        if (validation.rejectionReason) {
          text += `- **Rejection reason:** ${validation.rejectionReason}\n`;
        }

        text += `\n### Metadata\n`;
        text += `- **Has EXIF:** ${meta.hasExif ? "Yes" : "No"}\n`;
        if (meta.cameraModel) text += `- **Camera:** ${meta.cameraModel}\n`;
        if (meta.timestamp) {
          text += `- **Timestamp:** ${meta.timestamp.toISOString()}\n`;
        }
        if (meta.software) text += `- **Software:** ${meta.software}\n`;

        return textResult(text);
      });
    },
  });
}
