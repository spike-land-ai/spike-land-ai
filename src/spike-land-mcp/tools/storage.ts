/**
 * Storage Tools (CF Workers)
 *
 * Stubbed — R2 bindings not yet available in this worker.
 * Points users to spike.land for storage operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "./types";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";

export function registerStorageTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "storage_get_upload_url",
        "Get a presigned URL for uploading a file to object storage. " +
          "Currently delegates to spike.land — R2 bindings not yet available in this worker.",
        {
          filename: z.string().describe("Original filename"),
          content_type: z.string().describe("MIME type of the file"),
          purpose: z.enum(["image", "audio", "asset", "brand"]).describe("Purpose of the upload"),
        },
      )
      .meta({ category: "storage", tier: "workspace" })
      .handler(async () => {
        return textResult(
          "**Storage operations are managed at spike.land**\n\n" +
            "This worker does not have R2 bindings configured. " +
            "Use the spike.land platform directly for file uploads:\n" +
            "- Upload via https://spike.land/api/storage/upload\n" +
            "- Or use the spike.land MCP server's storage tools.",
        );
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "storage_register_upload",
        "Register a completed upload and create a database record. " +
          "Currently delegates to spike.land.",
        {
          r2_key: z.string().describe("The key returned by storage_get_upload_url"),
          purpose: z.enum(["image", "audio", "asset", "brand"]).describe("Purpose of the upload"),
          metadata: z.record(z.string(), z.unknown()).optional().describe("Additional metadata"),
        },
      )
      .meta({ category: "storage", tier: "workspace" })
      .handler(async () => {
        return textResult(
          "**Storage operations are managed at spike.land**\n\n" +
            "This worker does not have R2 bindings configured. " +
            "Use the spike.land platform directly for upload registration:\n" +
            "- Register via https://spike.land/api/storage/register\n" +
            "- Or use the spike.land MCP server's storage tools.",
        );
      }),
  );
}
