/**
 * `spike shell` command — interactive REPL for exploring MCP tools.
 */

import * as readline from "node:readline";
import type { Command } from "commander";
import { discoverConfig } from "../config/discovery";
import { ServerManager } from "../multiplexer/server-manager";
import { loadAliases } from "../alias/store";
import { AliasResolver } from "../alias/resolver";
import { createCompleter } from "../shell/completer";
import {
  handleAlias,
  handleCall,
  handleHelp,
  handleLoadToolset,
  handleReconnect,
  handleServers,
  handleTools,
  handleToolsets,
  type ShellContext,
} from "../shell/commands";
import { collect, parseInlineServers, parseInlineUrls } from "./common";
import { log } from "../util/logger";
import { bold, cyan } from "../shell/formatter";

export function registerShellCommand(program: Command): void {
  program
    .command("shell")
    .description("Interactive REPL for exploring MCP tools")
    .option("--config <path>", "Path to .mcp.json config file")
    .option("--server <name=command>", "Add an inline stdio server", collect, [])
    .option("--server-url <name=url>", "Add an inline URL server", collect, [])
    .action(async (options) => {
      log("Starting shell...");

      const config = await discoverConfig({
        configPath: options.config,
        inlineServers: parseInlineServers(options.server),
        inlineUrls: parseInlineUrls(options.serverUrl),
      });

      const serverCount = Object.keys(config.servers).length;
      if (serverCount === 0) {
        console.log("No MCP servers configured. Add servers to .mcp.json or use --server flags.");
        process.exit(1);
      }

      console.log(`Connecting to ${serverCount} server(s)...`);

      const manager = new ServerManager();
      await manager.connectAll(config);

      const connectedCount = manager.getServerNames().filter((n) => manager.isConnected(n)).length;
      console.log(`${bold("spike shell")} — ${connectedCount} server(s) connected. Type ${cyan("help")} for commands.\n`);

      const aliases = await loadAliases();
      const toolNames = new Set(manager.getAllTools().map((t) => t.namespacedName));
      const resolver = new AliasResolver(aliases, toolNames);

      const ctx: ShellContext = { manager, config, resolver };

      const completer = createCompleter(manager, resolver);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        completer,
        prompt: "spike> ",
      });

      rl.prompt();

      rl.on("line", async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          rl.prompt();
          return;
        }

        const parts = trimmed.split(/\s+/);
        const command = parts[0]!;
        const rest = parts.slice(1);

        let output: string | undefined;

        switch (command) {
          case "servers":
            output = handleServers(ctx);
            break;
          case "tools":
            output = handleTools(ctx, rest[0]);
            break;
          case "call":
            output = await handleCall(ctx, rest[0] ?? "", rest.slice(1).join(" ") || undefined);
            break;
          case "reconnect":
            output = await handleReconnect(ctx, rest[0] ?? "");
            break;
          case "toolsets":
            output = handleToolsets(ctx);
            break;
          case "load":
            output = handleLoadToolset(ctx, rest[0] ?? "");
            break;
          case "alias":
            output = await handleAlias(ctx, rest);
            break;
          case "help":
            output = handleHelp();
            break;
          case "quit":
          case "exit":
            rl.close();
            return;
          default: {
            // Try alias resolution
            const resolved = resolver.resolveCommand(command);
            if (resolved.type === "command") {
              // Re-dispatch with resolved command
              const newLine = [resolved.command, ...rest].join(" ");
              rl.emit("line", newLine);
              return;
            }
            output = `Unknown command: ${command}. Type ${cyan("help")} for available commands.`;
          }
        }

        if (output) {
          console.log(output);
        }
        rl.prompt();
      });

      rl.on("close", async () => {
        console.log("\nDisconnecting...");
        await manager.closeAll();
        process.exit(0);
      });
    });
}
