/**
 * Image Studio Tool Registration
 *
 * Single entry point: registerImageStudioTools(registry, userId, deps)
 * Registers all img_ tools into any MCP-compatible registry.
 *
 * Uses auto-discovery via tool-manifest.ts and runtime validation via validate.ts.
 */

import type {
  AnyToolSpec,
  CallToolResult,
  ImageStudioDeps,
  ImageStudioToolRegistry,
  ToolContext,
  ToolEvent,
} from "./types.js";

// Static imports for all tool modules (tree-shaking compatible)
import * as albumCreate from "./tools/album-create.js";
import * as album from "./tools/album.js";
import * as albumList from "./tools/album-list.js";
import * as albumUpdate from "./tools/album-update.js";
import * as albumDelete from "./tools/album-delete.js";
import * as albumImages from "./tools/album-images.js";
import * as albumReorder from "./tools/album-reorder.js";
import * as analyze from "./tools/analyze.js";
import * as autoTag from "./tools/auto-tag.js";
import * as avatarTool from "./tools/avatar.js";
import * as bannerTool from "./tools/banner.js";
import * as blend from "./tools/blend.js";
import * as bulkDelete from "./tools/bulk-delete.js";
import * as compare from "./tools/compare.js";
import * as credits from "./tools/credits.js";
import * as crop from "./tools/crop.js";
import * as deleteTool from "./tools/delete.js";
import * as diagram from "./tools/diagram.js";
import * as duplicateTool from "./tools/duplicate.js";
import * as edit from "./tools/edit.js";
import * as enhance from "./tools/enhance.js";
import * as exportImage from "./tools/export.js";
import * as generate from "./tools/generate.js";
import * as history from "./tools/history.js";
import * as icon from "./tools/icon.js";
import * as jobStatus from "./tools/job-status.js";
import * as list from "./tools/list.js";
import * as pipelineTool from "./tools/pipeline.js";
import * as pipelineDelete from "./tools/pipeline-delete.js";
import * as pipelineList from "./tools/pipeline-list.js";
import * as pipelineSave from "./tools/pipeline-save.js";
import * as removeBg from "./tools/remove-bg.js";
import * as resize from "./tools/resize.js";
import * as screenshot from "./tools/screenshot.js";
import * as share from "./tools/share.js";
import * as subjectDelete from "./tools/subject-delete.js";
import * as subjectSave from "./tools/subject-save.js";
import * as subjectList from "./tools/subject-list.js";
import * as updateTool from "./tools/update.js";
import * as upload from "./tools/upload.js";
import * as versions from "./tools/versions.js";
import * as watermark from "./tools/watermark.js";

import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";

// ── Module lookup map ──
const MODULE_MAP: Record<string, Record<string, unknown>> = {
  albumCreate,
  album,
  albumList,
  albumUpdate,
  albumDelete,
  albumImages,
  albumReorder,
  analyze,
  autoTag,
  avatar: avatarTool,
  banner: bannerTool,
  blend,
  bulkDelete,
  compare,
  credits,
  crop,
  delete: deleteTool,
  diagram,
  duplicate: duplicateTool,
  edit,
  enhance,
  export: exportImage,
  generate,
  history,
  icon,
  jobStatus,
  list,
  pipeline: pipelineTool,
  pipelineDelete,
  pipelineList,
  pipelineSave,
  removeBg,
  resize,
  screenshot,
  share,
  subjectDelete,
  subjectSave,
  subjectList,
  update: updateTool,
  upload,
  versions,
  watermark,
};

import type { BuiltTool } from "@spike-land-ai/shared/tool-builder";

function isToolExport(obj: unknown): obj is BuiltTool<unknown, unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "name" in obj &&
    typeof (obj as Record<string, unknown>).name === "string" &&
    "inputSchema" in obj &&
    (obj as Record<string, unknown>).inputSchema != null &&
    "handler" in obj &&
    typeof (obj as Record<string, unknown>).handler === "function"
  );
}

/**
 * Creates an MCP ToolSpec from a centralized BuiltTool export.
 */
function createToolFromExport(
  toolExport: BuiltTool<unknown, unknown>,
  ctx: ToolContext,
): AnyToolSpec {
  // zodToJsonSchema expects zod's ZodType — our structural type is compatible at runtime
  const jsonSchema = zodToJsonSchema(
    z.object(toolExport.inputSchema as Record<string, z.ZodTypeAny>) as unknown as Parameters<
      typeof zodToJsonSchema
    >[0],
    "inputSchema",
  ) as Record<string, unknown>;
  const defs = jsonSchema.definitions as Record<string, Record<string, unknown>> | undefined;
  const inputSchemaDef = defs?.inputSchema;
  const properties = (inputSchemaDef?.properties || jsonSchema.properties || {}) as Record<
    string,
    unknown
  >;
  const required = (inputSchemaDef?.required || jsonSchema.required || []) as string[];

  const toolName = toolExport.name.startsWith("img_") ? toolExport.name : `img_${toolExport.name}`;

  return {
    name: toolName,
    description: toolExport.description || `Execute ${toolExport.name}`,
    category: "img",
    tier: "free",
    inputSchema: {
      type: "object",
      properties,
      required,
    },
    handler: async (input: unknown) => {
      // The new BuiltTool.handler has its own internal validation and tryCatch logic.
      // We just need to pass the context.
      try {
        const result = await toolExport.handler(input, ctx as unknown as Record<string, unknown>);
        if (
          result &&
          typeof result === "object" &&
          "content" in result &&
          Array.isArray((result as unknown as Record<string, unknown>).content)
        ) {
          return result as CallToolResult;
        }
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "isError" in err &&
          (err as unknown as Record<string, unknown>).isError
        ) {
          return err as CallToolResult;
        }
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        };
      }
    },
  } as unknown as AnyToolSpec;
}

/** @deprecated Use registerImageStudioTools */
export const registerPixelTools = registerImageStudioTools;
/** @deprecated Use registerImageStudioTools */
export const registerNanoTools = registerImageStudioTools;

export interface RegisterOptions {
  onNotify?: (event: ToolEvent) => void;
  onProgress?: (progress: number, total: number, message?: string) => void;
}

export function registerImageStudioTools(
  registry: ImageStudioToolRegistry,
  userId: string,
  deps: ImageStudioDeps,
  options?: RegisterOptions,
): void {
  const notify = options?.onNotify ?? (() => {});
  const reportProgress =
    options?.onProgress ??
    ((progress: number, total: number, _message?: string) => {
      void progress;
      void total;
    });
  const context: ToolContext = { userId, deps, notify, reportProgress };

  // Collect all tool exports from all modules
  for (const [, moduleObj] of Object.entries(MODULE_MAP)) {
    for (const exportValue of Object.values(moduleObj)) {
      if (isToolExport(exportValue)) {
        registry.register(createToolFromExport(exportValue, context));
      }
    }
  }
}
