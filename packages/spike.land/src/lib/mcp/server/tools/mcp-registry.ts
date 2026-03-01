import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import {
    McpRegistryGetSchema,
    McpRegistryInstallSchema,
    McpRegistrySearchSchema,
} from "@/lib/mcp/schemas";
import { freeTool } from "../tool-builder/procedures.js";

export function registerMcpRegistryTools(
    registry: ToolRegistry,
    _userId: string,
): void {
    registry.registerBuilt(
        freeTool(_userId)
            .tool("mcp_registry_search", "Search across Smithery, Official MCP Registry, and Glama for MCP servers by keyword. Returns server names, descriptions, and sources.", McpRegistrySearchSchema.shape)
            .meta({ category: "mcp-registry", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { query, limit = 10 } = input;
                return safeToolCall("mcp_registry_search", async () => {
                    const { searchAllRegistries } = await import(
                        "@/lib/mcp/services/registry-client"
                    );
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
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("mcp_registry_get", "Get detailed information about a specific MCP server including connection config and required environment variables.", McpRegistryGetSchema.shape)
            .meta({ category: "mcp-registry", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { serverId, source } = input;
                return safeToolCall("mcp_registry_get", async () => {
                    const { searchSmithery, searchOfficialRegistry, searchGlama } = await import(
                        "@/lib/mcp/services/registry-client"
                    );

                    let results;
                    if (source === "smithery") results = await searchSmithery(serverId, 1);
                    else if (source === "official") {
                        results = await searchOfficialRegistry(serverId, 1);
                    } else results = await searchGlama(serverId, 1);

                    const server = results.find(s => s.id === serverId);
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
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("mcp_registry_install", "Auto-configure an MCP server by generating a .mcp.json entry. Provide the server ID and any required environment variables.", McpRegistryInstallSchema.shape)
            .meta({ category: "mcp-registry", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { serverId, source, envVars } = input;
                return safeToolCall("mcp_registry_install", async () => {
                    const { searchSmithery, searchOfficialRegistry, searchGlama } = await import(
                        "@/lib/mcp/services/registry-client"
                    );

                    let results;
                    if (source === "smithery") results = await searchSmithery(serverId, 1);
                    else if (source === "official") {
                        results = await searchOfficialRegistry(serverId, 1);
                    } else results = await searchGlama(serverId, 1);

                    const server = results.find(s => s.id === serverId);
                    if (!server) {
                        return textResult(
                            "**Error: NOT_FOUND**\nMCP server not found.\n**Retryable:** false",
                        );
                    }

                    const config = {
                        [server.name]: {
                            transport: server.transport,
                            url: server.url,
                            ...(envVars && Object.keys(envVars).length > 0
                                ? { env: envVars }
                                : {}),
                        },
                    };

                    return textResult(
                        `**MCP Server Configured:** ${server.name}\n\n`
                        + `Add to your \`.mcp.json\`:\n\`\`\`json\n${JSON.stringify(config, null, 2)
                        }\n\`\`\`\n\n`
                        + `**Transport:** ${server.transport}\n`
                        + `**Source:** ${server.source}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(_userId)
            .tool("mcp_registry_list_installed", "List all currently configured MCP servers from .mcp.json.", {})
            .meta({ category: "mcp-registry", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const fs = await import("node:fs");
                const path = await import("node:path");

                const mcpJsonPath = path.join(process.cwd(), ".mcp.json");
                if (!fs.existsSync(mcpJsonPath)) {
                    return textResult(
                        "No .mcp.json found. No MCP servers are configured.",
                    );
                }

                const content = fs.readFileSync(mcpJsonPath, "utf-8");
                const config = JSON.parse(content) as Record<string, unknown>;
                const mcpServers = (config.mcpServers ?? config) as Record<
                    string,
                    unknown
                >;
                const serverNames = Object.keys(mcpServers);

                if (serverNames.length === 0) {
                    return textResult("No MCP servers configured in .mcp.json.");
                }

                let text = `**Configured MCP Servers (${serverNames.length}):**\n\n`;
                for (const name of serverNames) {
                    const server = mcpServers[name] as Record<string, unknown>;
                    text += `- **${name}**: transport=${String(server.transport ?? "unknown")}`;
                    if (server.url) text += `, url=${String(server.url)}`;
                    text += "\n";
                }
                return textResult(text);
            })
    );
}
