/**
 * Tab completion for the REPL shell.
 */

import type { ServerManager } from "../multiplexer/server-manager";
import { fuzzyFilter } from "../util/fuzzy";

/** Duck-typed interface for alias resolution (optional dependency). */
export interface AliasResolver {
  resolveCommand?(input: string): string | undefined;
  getAliasNames?(): string[];
}

const REPL_COMMANDS = [
  "servers",
  "tools",
  "call",
  "reconnect",
  "help",
  "toolsets",
  "load",
  "quit",
  "exit",
  "alias",
];

const ALIAS_SUBCOMMANDS = ["set", "remove", "list"];

export type CompleterFunction = (line: string) => [string[], string];

/**
 * Creates a readline-compatible completer function.
 */
export function createCompleter(
  manager: ServerManager,
  aliasResolver?: AliasResolver,
): CompleterFunction {
  return (line: string): [string[], string] => {
    const trimmed = line.trimStart();
    const parts = trimmed.split(/\s+/);
    const command = parts[0] ?? "";

    // Completing the command itself (no space after first word)
    if (parts.length <= 1) {
      const allCommands = [...REPL_COMMANDS];
      if (aliasResolver?.getAliasNames) {
        allCommands.push(...aliasResolver.getAliasNames());
      }

      if (!command) {
        return [allCommands, ""];
      }

      const matches = fuzzyFilter(command, allCommands, c => c);
      return [matches.length > 0 ? matches : allCommands, command];
    }

    // Completing arguments based on command
    const partial = parts[parts.length - 1] ?? "";

    switch (command) {
      case "call": {
        // Complete tool names
        if (parts.length === 2) {
          const toolNames = manager.getAllTools().map(t => t.namespacedName);
          if (!partial) return [toolNames, ""];
          const matches = fuzzyFilter(partial, toolNames, n => n);
          return [matches.length > 0 ? matches : toolNames, partial];
        }
        return [[], partial];
      }

      case "tools":
      case "reconnect": {
        // Complete server names
        if (parts.length === 2) {
          const serverNames = manager.getServerNames();
          if (!partial) return [serverNames, ""];
          const matches = fuzzyFilter(partial, serverNames, n => n);
          return [matches.length > 0 ? matches : serverNames, partial];
        }
        return [[], partial];
      }

      case "alias": {
        // Complete alias subcommands
        if (parts.length === 2) {
          if (!partial) return [ALIAS_SUBCOMMANDS, ""];
          const matches = fuzzyFilter(partial, ALIAS_SUBCOMMANDS, s => s);
          return [matches.length > 0 ? matches : ALIAS_SUBCOMMANDS, partial];
        }
        return [[], partial];
      }

      default:
        return [[], partial];
    }
  };
}
