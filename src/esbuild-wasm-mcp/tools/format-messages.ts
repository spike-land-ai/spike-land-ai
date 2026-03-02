import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PartialMessage } from "@spike-land-ai/esbuild-wasm";
import { z } from "zod";
import { getEsbuildWasm } from "../wasm-api.js";
import { tryCatch, formatEsbuildError } from "../errors.js";

const LocationSchema = z
  .object({
    file: z.string().optional(),
    namespace: z.string().optional(),
    line: z.number().optional(),
    column: z.number().optional(),
    length: z.number().optional(),
    lineText: z.string().optional(),
    suggestion: z.string().optional(),
  })
  .optional()
  .nullable();

const MessageSchema = z.object({
  id: z.string().optional(),
  pluginName: z.string().optional(),
  text: z.string(),
  location: LocationSchema,
  notes: z
    .array(
      z.object({
        text: z.string(),
        location: LocationSchema,
      }),
    )
    .optional(),
  detail: z.unknown().optional(),
});

const FormatMessagesSchema = {
  messages: z.array(MessageSchema).describe("Array of esbuild Message objects to format"),
  kind: z.enum(["error", "warning"]).describe("Message kind"),
};

export function registerFormatMessagesTool(server: McpServer): void {
  server.tool(
    "esbuild_wasm_format_messages",
    "Format esbuild error or warning messages for display with context and colors",
    FormatMessagesSchema,
    async (args) => {
      const esbuild = await getEsbuildWasm();

      const result = await tryCatch(
        esbuild.formatMessages(args.messages as PartialMessage[], {
          kind: args.kind,
          color: false,
        }),
      );
      if (!result.ok) return formatEsbuildError(result.error);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    },
  );
}
