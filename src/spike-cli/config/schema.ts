/**
 * Zod schemas for validating .mcp.json config files.
 */

import { z } from "zod";

const toolFilterSchema = z
  .object({
    allowed: z.array(z.string()).optional(),
    blocked: z.array(z.string()).optional(),
  })
  .optional();

const stdioServerSchema = z.object({
  type: z.literal("stdio").optional(),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
  tools: toolFilterSchema,
});

const httpServerSchema = z.object({
  type: z.enum(["sse", "url"]),
  url: z.string().url(),
  env: z.record(z.string(), z.string()).optional(),
  tools: toolFilterSchema,
});

export const serverConfigSchema = z.union([stdioServerSchema, httpServerSchema]);

const toolsetSchema = z.object({
  servers: z.array(z.string()),
  description: z.string().optional(),
});

export const mcpConfigFileSchema = z.object({
  mcpServers: z.record(z.string(), serverConfigSchema),
  toolsets: z.record(z.string(), toolsetSchema).optional(),
  lazyLoading: z.boolean().optional(),
});

export type ValidatedMcpConfig = z.infer<typeof mcpConfigFileSchema>;

export function validateConfig(data: unknown): ValidatedMcpConfig {
  return mcpConfigFileSchema.parse(data);
}
