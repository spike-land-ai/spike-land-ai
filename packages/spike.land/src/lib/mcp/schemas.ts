import { z } from "zod";

export const McpRegistrySearchSchema = z.object({
  query: z.string().min(1).max(200).describe("Search query for MCP servers"),
  limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)"),
});

export const McpRegistryGetSchema = z.object({
  serverId: z.string().min(1).describe("Server identifier from search results"),
  source: z.enum(["smithery", "official", "glama"]).describe("Which registry the server came from"),
});

export const McpRegistryInstallSchema = z.object({
  serverId: z.string().min(1).describe("Server identifier"),
  source: z.enum(["smithery", "official", "glama"]).describe("Registry source"),
  envVars: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables needed by the server"),
});
