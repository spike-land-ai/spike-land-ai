/**
 * REPL command handlers for `spike shell`.
 */

import type { ServerManager } from "../multiplexer/server-manager";
import type { ResolvedConfig } from "../config/types";
import type { AliasResolver } from "../alias/resolver";
import { addAlias, loadAliases, removeAlias } from "../alias/store";
import {
  bold,
  cyan,
  dim,
  formatError,
  formatJson,
  formatSuccess,
  formatToolList,
  green,
} from "./formatter";

export interface ShellContext {
  manager: ServerManager;
  config: ResolvedConfig;
  resolver?: AliasResolver;
}

export function handleServers(ctx: ShellContext): string {
  const names = ctx.manager.getServerNames();
  if (names.length === 0) return "No servers connected.";

  const lines = names.map(name => {
    const connected = ctx.manager.isConnected(name);
    const toolCount = ctx.manager.getServerTools(name).length;
    const status = connected ? green("connected") : dim("disconnected");
    return `  ${bold(name)} — ${status} (${toolCount} tools)`;
  });

  return `${bold("Connected servers:")}\n${lines.join("\n")}`;
}

export function handleTools(ctx: ShellContext, serverFilter?: string): string {
  if (serverFilter) {
    const tools = ctx.manager.getServerTools(serverFilter);
    if (tools.length === 0) {
      return `No tools found for server "${serverFilter}".`;
    }
    return `${bold(`Tools from ${serverFilter}:`)}\n${formatToolList(tools)}`;
  }

  const allTools = ctx.manager.getAllTools();
  if (allTools.length === 0) return "No tools available.";

  return `${bold(`All tools (${allTools.length}):`)}\n${
    formatToolList(
      allTools.map(t => ({
        name: t.namespacedName,
        description: t.description,
      })),
    )
  }`;
}

export async function handleCall(
  ctx: ShellContext,
  toolName: string,
  argsJson?: string,
): Promise<string> {
  if (!toolName) return formatError("Usage: call <tool> [json-args]");

  let args: Record<string, unknown> = {};
  if (argsJson) {
    try {
      args = JSON.parse(argsJson) as Record<string, unknown>;
    } catch {
      return formatError(`Invalid JSON: ${argsJson}`);
    }
  }

  // Resolve tool aliases
  if (ctx.resolver) {
    const resolved = ctx.resolver.resolveTool(toolName);
    if (resolved.type === "tool") {
      toolName = resolved.toolName;
    } else if (resolved.type === "composite") {
      toolName = resolved.toolName;
      args = { ...resolved.args, ...args };
    }
  }

  try {
    const result = await ctx.manager.callTool(toolName, args);
    if (result.isError) {
      return formatError(result.content.map(c => c.text ?? "").join("\n"));
    }
    return formatJson(result.content);
  } catch (err) {
    return formatError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleReconnect(
  ctx: ShellContext,
  serverName: string,
): Promise<string> {
  if (!serverName) return formatError("Usage: reconnect <server>");

  const serverConfig = ctx.config.servers[serverName];
  if (!serverConfig) {
    return formatError(`Unknown server: ${serverName}`);
  }

  try {
    await ctx.manager.reconnect(serverName, serverConfig);
    const toolCount = ctx.manager.getServerTools(serverName).length;
    return green(`Reconnected to ${serverName} (${toolCount} tools)`);
  } catch (err) {
    return formatError(
      `Reconnect failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export function handleToolsets(ctx: ShellContext): string {
  const manager = ctx.manager.toolsetManager;
  if (!manager) {
    return dim(
      "Lazy loading is not enabled. Add toolsets + lazyLoading to config.",
    );
  }

  const toolsets = manager.listToolsets();
  if (toolsets.length === 0) return dim("No toolsets configured.");

  const lines = toolsets.map(ts => {
    const status = ts.loaded ? green("loaded") : dim("unloaded");
    const desc = ts.description ? ` — ${ts.description}` : "";
    return `  ${bold(ts.name)} [${status}] (${
      ts.servers.join(", ")
    }, ${ts.toolCount} tools)${desc}`;
  });

  return `${bold("Toolsets:")}\n${lines.join("\n")}`;
}

export function handleLoadToolset(ctx: ShellContext, name: string): string {
  if (!name) return formatError("Usage: load <toolset>");

  const manager = ctx.manager.toolsetManager;
  if (!manager) {
    return formatError("Lazy loading is not enabled.");
  }

  try {
    const result = manager.loadToolset(name);
    return formatSuccess(
      `Loaded toolset "${name}": ${result.loaded.join(", ")} (${result.toolCount} tools)`,
    );
  } catch (err) {
    return formatError(err instanceof Error ? err.message : String(err));
  }
}

export async function handleAlias(
  ctx: ShellContext,
  args: string[],
): Promise<string> {
  const [subcommand, name, ...rest] = args;

  if (!subcommand || subcommand === "list") {
    const aliases = await loadAliases();
    const sections = [
      { label: "Commands", data: aliases.commands },
      { label: "Tools", data: aliases.tools },
      { label: "Servers", data: aliases.servers },
      { label: "Composite", data: aliases.composite },
    ] as const;

    const lines: string[] = [];
    for (const section of sections) {
      const entries = Object.entries(section.data);
      if (entries.length === 0) continue;
      lines.push(bold(`${section.label}:`));
      for (const [key, value] of entries) {
        lines.push(
          `  ${cyan(key)} -> ${typeof value === "string" ? value : JSON.stringify(value)}`,
        );
      }
    }
    return lines.length > 0 ? lines.join("\n") : dim("No aliases configured.");
  }

  if (subcommand === "set") {
    if (!name || rest.length === 0) {
      return formatError("Usage: alias set <name> <expansion>");
    }
    const expansion = rest.join(" ");

    if (ctx.resolver?.isReserved(name)) {
      return formatError(`"${name}" is a reserved name and cannot be aliased.`);
    }

    const section = expansion.includes("__")
      ? "tools"
      : ["serve", "shell", "auth", "alias"].includes(expansion)
      ? "commands"
      : "servers";

    await addAlias(section, name, expansion);
    return formatSuccess(`Alias set: ${name} -> ${expansion} (${section})`);
  }

  if (subcommand === "remove") {
    if (!name) return formatError("Usage: alias remove <name>");
    const result = await removeAlias(name);
    if (result.removed) {
      return formatSuccess(`Removed alias "${name}" from ${result.section}`);
    }
    return formatError(`No alias found with name "${name}"`);
  }

  return formatError(
    `Unknown alias subcommand: ${subcommand}. Use set, remove, or list.`,
  );
}

export function handleHelp(): string {
  return `${bold("spike shell")} — Interactive MCP tool explorer

${bold("Commands:")}
  ${cyan("servers")}              List connected MCP servers
  ${cyan("tools")} ${dim("[server]")}      List available tools (optionally filter by server)
  ${cyan("call")} ${dim("<tool> [json]")}  Call a tool with optional JSON arguments
  ${cyan("reconnect")} ${dim("<server>")}  Reconnect to a server
  ${cyan("toolsets")}             List available toolsets (lazy loading)
  ${cyan("load")} ${dim("<toolset>")}      Load a toolset to enable its tools
  ${cyan("alias")} ${dim("<set|remove|list>")}  Manage aliases
  ${cyan("help")}                 Show this help
  ${cyan("quit")}                 Exit the shell`;
}
