#!/usr/bin/env node
/**
 * vibe-dev CLI - Lightweight development workflow for vibe-coded apps
 *
 * Usage:
 *   vibe-dev dev --codespace my-app    # Start dev mode with file watching
 *   vibe-dev pull --codespace my-app   # Download code to local
 *   vibe-dev push --codespace my-app   # Push local code to server
 *   vibe-dev claude [args]             # Run Claude Code with MCP configured
 */

import spawn from "cross-spawn";
import { program } from "commander";
import { readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { poll } from "../node-sys/agent.js";
import { getApiConfig } from "./api.js";
import { getQueueStats, getRedisConfig } from "./redis.js";
import { pullCode, pushCode } from "./sync.js";
import { downloadToLocal, getLocalPath, startDevMode } from "../lazy-imports/watcher.js";

const VERSION = "0.1.0";

program
  .name("vibe-dev")
  .description("Lightweight development workflow for vibe-coded apps")
  .version(VERSION);

// ============================================================
// dev command - Start development mode with file watching
// ============================================================
program
  .command("dev")
  .description("Start development mode with auto-sync")
  .option("-c, --codespace <id>", "Codespace ID(s) to watch", collect, [])
  .option("--debounce <ms>", "Debounce delay in milliseconds", "100")
  .action(async (options) => {
    const codespaces = options.codespace as string[];

    if (codespaces.length === 0) {
      console.error("Error: At least one --codespace is required");
      process.exit(1);
    }

    try {
      const { stop } = await startDevMode(codespaces, {
        debounceMs: Math.max(0, Math.min(60000, parseInt(options.debounce, 10) || 300)),
        onSync: (id) => {
          console.log(`🔄 ${id} synced - iframe should reload`);
        },
      });

      // Handle graceful shutdown
      process.on("SIGINT", async () => {
        console.log("\n\nShutting down...");
        await stop();
        process.exit(0);
      });

      process.on("SIGTERM", async () => {
        await stop();
        process.exit(0);
      });

      // Keep process alive
      await new Promise(() => {});
    } catch (error) {
      console.error("Failed to start dev mode:", error);
      process.exit(1);
    }
  });

// ============================================================
// pull command - Download code from server to local
// ============================================================
program
  .command("pull")
  .description("Download code from testing.spike.land to local file")
  .requiredOption("-c, --codespace <id>", "Codespace ID")
  .action(async (options) => {
    try {
      const localPath = await downloadToLocal(options.codespace);
      console.log(`\nCode saved to: ${localPath}`);
    } catch (error) {
      console.error("Pull failed:", error);
      process.exit(1);
    }
  });

// ============================================================
// push command - Push local code to server
// ============================================================
program
  .command("push")
  .description("Push local code to testing.spike.land")
  .requiredOption("-c, --codespace <id>", "Codespace ID")
  .option("--no-run", "Don't transpile (skip run step)")
  .action(async (options) => {
    try {
      const localPath = getLocalPath(options.codespace);
      const code = await readFile(localPath, "utf-8");

      console.log(`📤 Pushing ${options.codespace} (${code.length} bytes)...`);
      const result = await pushCode(options.codespace, code, options.run !== false);

      console.log(`✅ Pushed successfully`);
      console.log(`   Hash: ${result.hash}`);
      console.log(`   Updated: ${result.updated.join(", ")}`);
    } catch (error) {
      console.error("Push failed:", error);
      process.exit(1);
    }
  });

// ============================================================
// code command - Get/set code directly (no local file)
// ============================================================
program
  .command("code")
  .description("Get or set code directly")
  .requiredOption("-c, --codespace <id>", "Codespace ID")
  .option("--get", "Get code from server")
  .option("--set <code>", "Set code on server")
  .action(async (options) => {
    try {
      if (options.get) {
        const code = await pullCode(options.codespace);
        console.log(code);
      } else if (options.set) {
        const result = await pushCode(options.codespace, options.set);
        console.log("Updated:", result.updated.join(", "));
      } else {
        console.error("Specify --get or --set");
        process.exit(1);
      }
    } catch (error) {
      console.error("Operation failed:", error);
      process.exit(1);
    }
  });

// ============================================================
// poll command - Poll Redis queue and process agent messages
// ============================================================
program
  .command("poll")
  .description("Poll Redis queue and process agent messages")
  .option("--once", "Run once and exit (don't loop)")
  .option("--interval <ms>", "Polling interval in milliseconds", "5000")
  .option("--stats", "Show queue statistics and exit")
  .action(async (options) => {
    try {
      const redisConfig = getRedisConfig();
      const apiConfig = getApiConfig();

      console.log("vibe-dev Agent Poll");
      console.log("===================");
      console.log(`API URL: ${apiConfig.baseUrl}`);
      console.log(`Redis URL: ${redisConfig.url.substring(0, 30)}...`);

      // Show stats and exit
      if (options.stats) {
        const stats = await getQueueStats(redisConfig);
        console.log("\nQueue Statistics:");
        console.log(`  Apps with pending: ${stats.appsWithPending}`);
        console.log(`  Total pending messages: ${stats.totalPendingMessages}`);
        for (const app of stats.apps) {
          console.log(`  - ${app.appId}: ${app.count} pending`);
        }
        process.exit(0);
      }

      // Run once mode
      if (options.once) {
        console.log("Running once...\n");
        const processed = await poll(redisConfig, apiConfig);
        console.log(`\nDone. Processed ${processed} apps.`);
        process.exit(0);
      }

      // Continuous polling
      const interval = Math.max(100, Math.min(60000, parseInt(options.interval, 10) || 2000));
      console.log(`Polling every ${interval}ms (Ctrl+C to stop)\n`);

      const pollLoop = async () => {
        try {
          await poll(redisConfig, apiConfig);
        } catch (error) {
          console.error("Poll error:", error);
        }
        setTimeout(pollLoop, interval);
      };

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log("\nShutting down...");
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        console.log("\nShutting down...");
        process.exit(0);
      });

      await pollLoop();
    } catch (error) {
      console.error("Poll command failed:", error);
      process.exit(1);
    }
  });

// ============================================================
// chat-poll command - Poll spike-chat channels instead of Redis
// ============================================================
program
  .command("chat-poll")
  .description("Poll spike-chat channels for new messages (replaces Redis polling)")
  .option("--chat-url <url>", "Spike-chat base URL", "https://chat.spike.land")
  .option("--api-key <key>", "Agent API key for spike-chat auth")
  .option("--channels <ids>", "Comma-separated channel IDs to watch")
  .option("--interval <ms>", "Polling interval in milliseconds", "5000")
  .option("--once", "Run once and exit")
  .action(async (options) => {
    try {
      const { createSpikeChatConfig, startPollingLoop, listAppChannels, pollChannels, postMessage } =
        await import("./spike-chat-poller.js");

      const config = createSpikeChatConfig({
        chatUrl: options.chatUrl,
        apiKey: options.apiKey || process.env.AGENT_API_KEY,
        pollInterval: parseInt(options.interval, 10) || 5000,
      });

      console.log("vibe-dev Chat Poll");
      console.log("===================");
      console.log(`Chat URL: ${config.chatUrl}`);
      console.log(`Poll interval: ${config.pollInterval}ms`);

      // Determine channels to watch
      let channelIds: string[];
      if (options.channels) {
        channelIds = (options.channels as string).split(",").map((s: string) => s.trim());
      } else {
        console.log("Discovering app-* channels...");
        const appChannels = await listAppChannels(config);
        channelIds = appChannels.map((ch) => ch.slug);
        if (channelIds.length === 0) {
          console.log("No app channels found. Waiting for channels to be created...");
          channelIds = ["app-default"];
        }
      }

      console.log(`Watching channels: ${channelIds.join(", ")}\n`);

      if (options.once) {
        const cursors = new Map<string, string>();
        const results = await pollChannels(config, channelIds, cursors);
        for (const batch of results) {
          console.log(`[${batch.channelId}] ${batch.messages.length} new messages`);
          for (const msg of batch.messages) {
            console.log(`  ${msg.userId}: ${msg.content.substring(0, 100)}`);
          }
        }
        process.exit(0);
      }

      const { stop } = startPollingLoop(config, channelIds, async (channelId, msgs) => {
        for (const msg of msgs) {
          console.log(`[${channelId}] ${msg.userId}: ${msg.content.substring(0, 100)}`);

          // Post a simple acknowledgment (in production, this would trigger Claude)
          await postMessage(
            config,
            channelId,
            `Received: "${msg.content.substring(0, 50)}..." — processing...`,
          );
        }
      });

      process.on("SIGINT", () => {
        console.log("\nStopping chat poll...");
        stop();
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        stop();
        process.exit(0);
      });
    } catch (error) {
      console.error("Chat poll failed:", error);
      process.exit(1);
    }
  });

// ============================================================
// claude command - Run Claude Code with MCP tools configured
// ============================================================
program
  .command("claude")
  .description("Run Claude Code with spike-land MCP tools")
  .option("-c, --codespace <id>", "Codespace ID for context")
  .option("-p, --prompt <text>", "One-shot prompt (non-interactive)")
  .allowUnknownOption(true)
  .action(async (options, command) => {
    try {
      // Validate codespace ID to prevent injection/path traversal
      if (options.codespace && !/^[a-zA-Z0-9._-]+$/.test(options.codespace)) {
        console.error("Error: Invalid codespace ID format");
        process.exit(1);
      }

      // Create temporary MCP config
      const mcpConfigPath = await createMcpConfig();

      const args = ["--mcp-config", mcpConfigPath];

      // Add codespace context to system prompt
      if (options.codespace) {
        const systemPrompt = buildSystemPrompt(options.codespace);
        args.push("--system-prompt", systemPrompt);
      }

      // Pass through any additional arguments
      const extraArgs = command.args || [];
      args.push(...extraArgs);

      // Add prompt via stdin instead of arguments if provided to prevent breakout
      const isInteractive = !options.prompt;
      if (options.prompt) {
        args.push("-");
      }

      console.log(`🤖 Starting Claude Code...`);
      if (options.codespace) {
        console.log(`   Codespace: ${options.codespace}`);
      }

      // Spawn Claude
      const claude = spawn("claude", args, {
        stdio: isInteractive ? "inherit" : ["pipe", "inherit", "inherit"],
        env: process.env,
      });

      if (options.prompt) {
        claude.stdin?.write(options.prompt);
        claude.stdin?.end();
      }

      claude.on("close", (code: number | null) => {
        if (code !== null) {
          process.exit(code);
        } else {
          process.exit(0);
        }
      });

      claude.on("error", (err: Error) => {
        console.error("Failed to spawn Claude:", err);
        process.exit(1);
      });
    } catch (error) {
      console.error("Failed to run Claude:", error);
      process.exit(1);
    }
  });

// ============================================================
// Helper functions
// ============================================================

/**
 * Collect multiple values for an option
 */
/* c8 ignore start */
function collect(value: string, previous: string[]): string[] {
  return previous.concat([value]);
}
/* c8 ignore stop */

/**
 * Create temporary MCP configuration file
 * Includes spike-land MCP (codespace tools) and Playwright MCP (browser automation)
 */
async function createMcpConfig(): Promise<string> {
  const configDir = join(tmpdir(), `vibe-dev-mcp-${Date.now()}`);
  const { mkdir } = await import("fs/promises");
  await mkdir(configDir, { recursive: true });
  const configPath = join(configDir, "mcp-config.json");

  const config = {
    mcpServers: {
      "spike-land": {
        type: "url",
        url: "https://spike.land/api/mcp",
      },
      playwright: {
        type: "stdio",
        command: "npx",
        args: ["-y", "@anthropic/mcp-server-playwright"],
        env: {},
      },
    },
  };

  await writeFile(configPath, JSON.stringify(config, null, 2));
  return configPath;
}

/**
 * Build system prompt for Claude with codespace context
 */
function buildSystemPrompt(codespaceId: string): string {
  const localPath = getLocalPath(codespaceId);

  return `You are developing a React application in codespace "${codespaceId}".

## Local Development Mode

The code is synced to a local file:
- **File path**: ${localPath}
- **Auto-sync**: Changes automatically sync to testing.spike.land
- **Live preview**: https://testing.spike.land/live/${codespaceId}

## Workflow

1. Read the file to see current code
2. Edit the file with your changes
3. Changes auto-sync and preview reloads

## MCP Tools (Alternative)

If local file editing isn't working, use MCP tools:
- mcp__spike-land__codespace_update: Create/update code
- mcp__spike-land__codespace_run: Transpile code
- mcp__spike-land__codespace_screenshot: Get screenshot
- mcp__spike-land__codespace_link: Get shareable link

## Guidelines

- Write complete, working React/TypeScript with Tailwind CSS
- ACTUALLY make the changes - don't just describe them
- Test by checking the live preview`;
}

// ============================================================
// Main
// ============================================================

program.parse();
