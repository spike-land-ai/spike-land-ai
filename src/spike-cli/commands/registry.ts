/**
 * `spike registry` commands — search and add MCP servers from the registry.
 */

import type { Command } from "commander";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadTokens } from "../auth/token-store";
import { getRegistryServer, searchRegistry } from "../registry/client";
import type { RegistryServer } from "../registry/client";

function formatServer(server: RegistryServer): string {
  const tags = server.tags?.length ? ` [${server.tags.join(", ")}]` : "";
  return `  ${server.id} — ${server.name}${tags}\n    ${server.description}`;
}

export function registerRegistryCommand(program: Command): void {
  const registry = program
    .command("registry")
    .description("Browse and install MCP servers from the registry");

  registry
    .command("search [query]")
    .description("Search the MCP server registry")
    .action(async (query?: string) => {
      if (!query) {
        console.error("Provide a search term. Example: spike registry search chess");
        return;
      }

      const tokens = await loadTokens();
      if (!tokens) {
        console.error("Not logged in. Run `spike auth login` first.");
        process.exit(1);
      }

      const results = await searchRegistry(query, tokens.baseUrl, tokens.accessToken);

      if (results.length === 0) {
        console.error("No servers found.");
        return;
      }

      console.error(`Found ${results.length} server(s):\n`);
      for (const server of results) {
        console.error(formatServer(server));
        console.error("");
      }
    });

  registry
    .command("add <serverId>")
    .description("Add a server from the registry to ~/.mcp.json")
    .action(async (serverId: string) => {
      const tokens = await loadTokens();
      if (!tokens) {
        console.error("Not logged in. Run `spike auth login` first.");
        process.exit(1);
      }

      const server = await getRegistryServer(serverId, tokens.baseUrl, tokens.accessToken);
      if (!server) {
        console.error(`Server "${serverId}" not found in registry.`);
        process.exit(1);
      }

      // Read existing global config
      const configPath = join(homedir(), ".mcp.json");
      let config: { mcpServers: Record<string, unknown> } = { mcpServers: {} };

      if (existsSync(configPath)) {
        try {
          const content = await readFile(configPath, "utf-8");
          config = JSON.parse(content) as typeof config;
          if (!config.mcpServers) config.mcpServers = {};
        } catch {
          // Start fresh on parse error
        }
      }

      // Build server entry
      if (server.url) {
        config.mcpServers[server.id] = { type: "url", url: server.url };
      } else if (server.command) {
        config.mcpServers[server.id] = {
          command: server.command,
          ...(server.args?.length ? { args: server.args } : {}),
        };
      } else {
        console.error(`Server "${serverId}" has no url or command — cannot add.`);
        process.exit(1);
      }

      await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
      console.error(`Added "${server.name}" to ${configPath}`);
    });
}
