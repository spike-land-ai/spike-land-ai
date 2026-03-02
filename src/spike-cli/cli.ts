#!/usr/bin/env node
/**
 * spike — MCP multiplexer CLI
 *
 * Usage:
 *   spike auth login|logout|status  Manage authentication
 *   spike alias set|remove|list     Manage aliases
 *   spike completions install|uninstall  Shell tab completions
 *   spike registry search|add       Browse MCP server registry
 */

import { config } from "dotenv";
import { program } from "commander";
import { registerAuthCommand } from "./commands/auth";
import { registerAliasCommand } from "./commands/alias";
import { registerCompletionsCommand } from "./commands/completions";
import { registerRegistryCommand } from "./commands/registry";
import { registerAgentCommand } from "./commands/agent";
import { setVerbose } from "./util/logger";
import { loadAliases } from "./alias/store";

// Load environment variables from .env.local and .env
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const VERSION = "0.1.0";

/**
 * Rewrite process.argv for command-level aliases.
 * If argv[2] matches a command alias, replace it before Commander parses.
 */
async function rewriteCommandAliases(): Promise<void> {
  try {
    const aliases = await loadAliases();
    const firstArg = process.argv[2];
    if (firstArg && aliases.commands[firstArg]) {
      process.argv[2] = aliases.commands[firstArg];
    }
  } catch {
    // Alias loading is best-effort — don't block startup
  }
}

/**
 * Handle --generate-completions for dynamic shell completion.
 * Called by the completion scripts installed via `spike completions install`.
 */
function handleGenerateCompletions(): boolean {
  const idx = process.argv.indexOf("--generate-completions");
  if (idx === -1) return false;

  const commands = ["auth", "alias", "completions", "registry"];
  const globalOptions = ["--verbose", "--base-url", "--help", "--version"];

  // Output all commands and options for the completion script to filter
  for (const cmd of commands) {
    console.log(cmd);
  }
  for (const opt of globalOptions) {
    console.log(opt);
  }
  return true;
}

export async function main(): Promise<void> {
  // Handle dynamic completion generation (exit early)
  if (handleGenerateCompletions()) return;

  // Rewrite command aliases before Commander parses
  await rewriteCommandAliases();

  program
    .name("spike")
    .description("MCP Platform CLI")
    .version(VERSION)
    .option("--verbose", "Verbose logging to stderr")
    .option("--base-url <url>", "Base URL for spike.land", "https://spike.land")
    .hook("preAction", (thisCommand) => {
      const opts = thisCommand.opts();
      if (opts.verbose) {
        setVerbose(true);
      }
    });

  registerAuthCommand(program);
  registerAliasCommand(program);
  registerCompletionsCommand(program);
  registerRegistryCommand(program);
  registerAgentCommand(program);

  program.parse();
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error(`spike: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
