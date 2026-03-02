/**
 * MCP Registry MCP Tools (CF Workers)
 *
 * MCP server discovery: search Smithery, Official MCP Registry, and Glama.
 * Uses direct fetch to registry APIs — no Redis cache (stateless worker uses KV if needed).
 * Ported from spike.land — no @/lib imports, no Redis.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, textResult } from "../procedures/index";
import { safeToolCall } from "./tool-helpers";
import type { DrizzleDB } from "../db/index";

// ─── Constants ──────────────────────────────────────────────────────────────

const SMITHERY_API_BASE = "https://registry.smithery.ai/api/v1";
const OFFICIAL_MCP_REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0.1/servers";
const GLAMA_API_BASE = "https://glama.ai/api/mcp/v1/servers";

// ─── Types ──────────────────────────────────────────────────────────────────

interface McpServerInfo {
  id: string;
  name: string;
  description: string;
  source: "smithery" | "official" | "glama";
  url: string;
  transport: "stdio" | "sse" | "streamable-http";
  envVarsRequired: string[];
  homepage?: string;
  stars?: number;
}

// ─── Registry Search Functions ──────────────────────────────────────────────

async function searchSmithery(query: string, limit: number): Promise<McpServerInfo[]> {
  const url = `${SMITHERY_API_BASE}/servers?q=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) return [];

    const data = (await response.json()) as {
      servers?: Array<{
        qualifiedName: string;
        displayName: string;
        description: string;
        homepage?: string;
        connections?: Array<{ type: string }>;
      }>;
    };

    return (data.servers ?? []).map((s) => ({
      id: s.qualifiedName,
      name: s.displayName,
      description: s.description ?? "",
      source: "smithery" as const,
      url: `https://smithery.ai/server/${s.qualifiedName}`,
      transport: (s.connections?.[0]?.type as "stdio" | "sse" | "streamable-http") ?? "stdio",
      envVarsRequired: [],
      ...(s.homepage !== undefined ? { homepage: s.homepage } : {}),
    }));
  } catch {
    return [];
  }
}

async function searchOfficialRegistry(query: string, limit: number): Promise<McpServerInfo[]> {
  const url = `${OFFICIAL_MCP_REGISTRY_BASE}?q=${encodeURIComponent(query)}&count=${limit}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as {
      servers?: Array<{
        id: string;
        name: string;
        description: string;
        url?: string;
        transport?: string;
      }>;
    };

    return (data.servers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      source: "official" as const,
      url: s.url ?? "",
      transport: (s.transport as "stdio" | "sse" | "streamable-http") ?? "stdio",
      envVarsRequired: [],
    }));
  } catch {
    return [];
  }
}

async function searchGlama(query: string, limit: number): Promise<McpServerInfo[]> {
  const url = `${GLAMA_API_BASE}?search=${encodeURIComponent(query)}&limit=${limit}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = (await response.json()) as {
      servers?: Array<{
        id: string;
        name: string;
        description: string;
        url?: string;
        transport?: string;
        stars?: number;
      }>;
    };

    return (data.servers ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description ?? "",
      source: "glama" as const,
      url: s.url ?? "",
      transport: (s.transport as "stdio" | "sse" | "streamable-http") ?? "stdio",
      envVarsRequired: [],
      ...(s.stars !== undefined ? { stars: s.stars } : {}),
    }));
  } catch {
    return [];
  }
}

async function searchAllRegistries(query: string, limit: number): Promise<McpServerInfo[]> {
  const [smithery, official, glama] = await Promise.allSettled([
    searchSmithery(query, limit),
    searchOfficialRegistry(query, limit),
    searchGlama(query, limit),
  ]);

  const results: McpServerInfo[] = [];
  if (smithery.status === "fulfilled") results.push(...smithery.value);
  if (official.status === "fulfilled") results.push(...official.value);
  if (glama.status === "fulfilled") results.push(...glama.value);

  // Deduplicate by name (case-insensitive)
  const seen = new Map<string, McpServerInfo>();
  for (const server of results) {
    const k = server.name.toLowerCase();
    if (!seen.has(k)) seen.set(k, server);
  }

  return Array.from(seen.values()).slice(0, limit);
}

// ─── Tool Registration ──────────────────────────────────────────────────────

export function registerMcpRegistryTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  // Tool 1: mcp_registry_search
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "mcp_registry_search",
        "Search across Smithery, Official MCP Registry, and Glama for MCP servers by keyword. Returns server names, descriptions, and sources.",
        {
          query: z.string().min(1).max(200).describe("Search query for MCP servers."),
          limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
        },
      )
      .meta({ category: "mcp-registry", tier: "free" })
      .handler(async ({ input }) => {
        const { query, limit = 10 } = input;
        return safeToolCall(
          "mcp_registry_search",
          async () => {
            const results = await searchAllRegistries(query, limit);
            if (results.length === 0) {
              return textResult("No MCP servers found matching your query.");
            }

            let text = `**MCP Servers Found (${results.length}):**\n\n`;
            for (const server of results) {
              text += `- **${server.name}** (${server.source})\n`;
              text += `  ${server.description.slice(0, 200)}\n`;
              text += `  ID: \`${server.id}\` | Transport: ${server.transport}\n`;
              if (server.homepage) text += `  Homepage: ${server.homepage}\n`;
              text += "\n";
            }
            return textResult(text);
          },
          { timeoutMs: 30_000 },
        );
      }),
  );

  // Tool 2: mcp_registry_get
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "mcp_registry_get",
        "Get detailed information about a specific MCP server including connection config and required environment variables.",
        {
          serverId: z.string().min(1).describe("Server identifier from search results."),
          source: z
            .enum(["smithery", "official", "glama"])
            .describe("Which registry the server came from."),
        },
      )
      .meta({ category: "mcp-registry", tier: "free" })
      .handler(async ({ input }) => {
        const { serverId, source } = input;
        return safeToolCall(
          "mcp_registry_get",
          async () => {
            let results: McpServerInfo[];
            if (source === "smithery") results = await searchSmithery(serverId, 1);
            else if (source === "official") results = await searchOfficialRegistry(serverId, 1);
            else results = await searchGlama(serverId, 1);

            const server = results.find((s) => s.id === serverId);
            if (!server) {
              return textResult(
                "**Error: NOT_FOUND**\nMCP server not found.\n**Retryable:** false",
              );
            }

            let text = `**${server.name}**\n\n`;
            text += `**Source:** ${server.source}\n`;
            text += `**Transport:** ${server.transport}\n`;
            text += `**URL:** ${server.url}\n`;
            if (server.homepage) text += `**Homepage:** ${server.homepage}\n`;
            if (server.envVarsRequired.length > 0) {
              text += `**Required Env Vars:** ${server.envVarsRequired.join(", ")}\n`;
            }
            text += `\n**Description:**\n${server.description}\n`;
            return textResult(text);
          },
          { timeoutMs: 30_000 },
        );
      }),
  );

  // Tool 3: mcp_registry_install
  registry.registerBuilt(
    freeTool(userId, db)
      .tool(
        "mcp_registry_install",
        "Auto-configure an MCP server by generating a .mcp.json entry. Provide the server ID and any required environment variables.",
        {
          serverId: z.string().min(1).describe("Server identifier."),
          source: z.enum(["smithery", "official", "glama"]).describe("Registry source."),
          envVars: z
            .record(z.string(), z.string())
            .optional()
            .describe("Environment variables needed by the server."),
        },
      )
      .meta({ category: "mcp-registry", tier: "free" })
      .handler(async ({ input }) => {
        const { serverId, source, envVars } = input;
        return safeToolCall(
          "mcp_registry_install",
          async () => {
            let results: McpServerInfo[];
            if (source === "smithery") results = await searchSmithery(serverId, 1);
            else if (source === "official") results = await searchOfficialRegistry(serverId, 1);
            else results = await searchGlama(serverId, 1);

            const server = results.find((s) => s.id === serverId);
            if (!server) {
              return textResult(
                "**Error: NOT_FOUND**\nMCP server not found.\n**Retryable:** false",
              );
            }

            const config = {
              [server.name]: {
                transport: server.transport,
                url: server.url,
                ...(envVars && Object.keys(envVars).length > 0 ? { env: envVars } : {}),
              },
            };

            return textResult(
              `**MCP Server Configured:** ${server.name}\n\n` +
                `Add to your \`.mcp.json\`:\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\`\n\n` +
                `**Transport:** ${server.transport}\n` +
                `**Source:** ${server.source}`,
            );
          },
          { timeoutMs: 30_000 },
        );
      }),
  );
}
