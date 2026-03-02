/**
 * Alias resolver — resolves alias names to their targets.
 */

import type { AliasConfig } from "./types";

const RESERVED_NAMES = new Set([
  "help",
  "quit",
  "exit",
  "servers",
  "tools",
  "call",
  "reconnect",
  "toolsets",
  "load",
  "alias",
]);

type CommandResult = { type: "command"; command: string } | { type: "none" };
type ToolResult =
  | { type: "tool"; toolName: string }
  | { type: "composite"; toolName: string; args: Record<string, unknown> }
  | { type: "none" };

export class AliasResolver {
  private aliases: AliasConfig;
  private realToolNames: Set<string>;

  constructor(aliases: AliasConfig, realToolNames?: Set<string>) {
    this.aliases = aliases;
    this.realToolNames = realToolNames ?? new Set();
  }

  resolveCommand(input: string): CommandResult {
    const target = this.aliases.commands[input];
    if (target) return { type: "command", command: target };
    return { type: "none" };
  }

  resolveTool(input: string): ToolResult {
    // Composite first
    const composite = this.aliases.composite[input];
    if (composite) {
      if (this.realToolNames.has(input)) {
        console.error(`Warning: alias "${input}" shadows a real tool; using real tool`);
        return { type: "tool", toolName: input };
      }
      return {
        type: "composite",
        toolName: composite.tool,
        args: composite.args ?? {},
      };
    }

    // Tool alias
    const toolTarget = this.aliases.tools[input];
    if (toolTarget) {
      if (this.realToolNames.has(input)) {
        console.error(`Warning: alias "${input}" shadows a real tool; using real tool`);
        return { type: "tool", toolName: input };
      }
      return { type: "tool", toolName: toolTarget };
    }

    return { type: "none" };
  }

  resolveServer(input: string): string | null {
    return this.aliases.servers[input] ?? null;
  }

  getAliasNames(): string[] {
    return [
      ...Object.keys(this.aliases.commands),
      ...Object.keys(this.aliases.tools),
      ...Object.keys(this.aliases.servers),
      ...Object.keys(this.aliases.composite),
    ];
  }

  isReserved(name: string): boolean {
    return RESERVED_NAMES.has(name);
  }
}
