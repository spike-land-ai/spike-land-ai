/**
 * Slash command registry for the chat REPL.
 * Handles built-in commands and direct MCP tool invocation via `/tool_name`.
 */

import type { Interface as ReadlineInterface } from "node:readline";
import type { ChatClient, Message } from "./client";
import type {
  NamespacedTool,
  ServerManager,
} from "../multiplexer/server-manager";
import {
  executeToolCall,
  extractDefaults,
  getRequiredParams,
} from "./tool-adapter";
import { fuzzyFilter, fuzzyScore } from "../util/fuzzy";
import { bold, cyan, dim, green, yellow } from "../shell/formatter";
import type { AppInfo, AppRegistry } from "./app-registry";

/** Parsed slash command input. */
export interface ParsedSlashInput {
  command: string;
  argsRaw: string;
}

/** Grouped tools for display. */
export interface ToolGroup {
  prefix: string;
  tools: NamespacedTool[];
}

/** App-aware tool group for display. */
export interface AppToolGroup {
  key: string;
  app: AppInfo | null;
  tools: NamespacedTool[];
  hiddenCount: number;
}

/** Config prerequisites: tools that must be called before others become usable. */
const CONFIG_PREREQUISITES: Record<string, string[]> = {
  set_project_root: ["run_tests", "list_tests", "analyze_coverage"],
};

/** Session state tracking tool invocation context. */
export class SessionState {
  /** Maps prefix (e.g. "chess") to list of IDs created during this session. */
  private created = new Map<string, string[]>();

  /** Maps param name (e.g. "game_id") to list of IDs seen in results. */
  private idsByKey = new Map<string, string[]>();

  /** Tracks config prerequisite tools that have been called. */
  private configToolsCalled = new Set<string>();

  recordCreate(prefix: string, ids: string[]): void {
    const existing = this.created.get(prefix) ?? [];
    this.created.set(prefix, [...existing, ...ids]);
  }

  hasCreated(prefix: string): boolean {
    const ids = this.created.get(prefix);
    return !!ids && ids.length > 0;
  }

  getCreatedIds(prefix: string): string[] {
    return this.created.get(prefix) ?? [];
  }

  /** Record all *_id fields found in a tool result JSON. */
  recordIds(result: string): void {
    try {
      const parsed = JSON.parse(result);
      if (typeof parsed !== "object" || parsed === null) return;
      for (const [key, value] of Object.entries(parsed)) {
        if (key.endsWith("_id") && typeof value === "string") {
          const existing = this.idsByKey.get(key) ?? [];
          existing.push(value);
          this.idsByKey.set(key, existing);
        }
        // Also track bare "id" as a generic ID
        if (key === "id" && typeof value === "string") {
          const existing = this.idsByKey.get("id") ?? [];
          existing.push(value);
          this.idsByKey.set("id", existing);
        }
      }
    } catch {
      // Not JSON, skip
    }
  }

  /** Get the most recently seen value for a param name (e.g. "game_id"). */
  getLatestId(paramName: string): string | undefined {
    const ids = this.idsByKey.get(paramName);
    if (ids && ids.length > 0) return ids[ids.length - 1];
    return undefined;
  }

  /** Check if an ID param has been seen in any result. */
  hasId(paramName: string): boolean {
    const ids = this.idsByKey.get(paramName);
    return !!ids && ids.length > 0;
  }

  /** Record that a config tool was called. */
  recordConfigCall(toolName: string): void {
    this.configToolsCalled.add(toolName);
  }

  /** Check if a config tool has been called. */
  hasConfigBeenCalled(toolName: string): boolean {
    return this.configToolsCalled.has(toolName);
  }
}

/** Context passed to the slash command handler. */
export interface SlashCommandContext {
  manager: ServerManager;
  client: ChatClient;
  messages: Message[];
  sessionState: SessionState;
  appRegistry?: AppRegistry;
  rl?: ReadlineInterface;
}

/** Result of handling a slash command. */
export interface SlashCommandResult {
  /** Text to display to the user. Empty string means nothing to print. */
  output: string;
  /** If true, the REPL should exit. */
  exit: boolean;
  /** If true, the conversation was cleared. */
  cleared: boolean;
}

/**
 * Parse a slash input string into command name and optional raw args.
 * Examples:
 *   "/tools" → { command: "tools", argsRaw: "" }
 *   "/tools chess" → { command: "tools", argsRaw: "chess" }
 *   '/chess_create_game {"time_control": "RAPID_10"}' → { command: "chess_create_game", argsRaw: '{"time_control": "RAPID_10"}' }
 */
export function parseSlashInput(input: string): ParsedSlashInput {
  const withoutSlash = input.slice(1);
  const spaceIndex = withoutSlash.indexOf(" ");
  if (spaceIndex === -1) {
    return { command: withoutSlash.trim(), argsRaw: "" };
  }
  return {
    command: withoutSlash.slice(0, spaceIndex).trim(),
    argsRaw: withoutSlash.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Extract a category prefix from a tool name.
 * Strips the server namespace prefix first (e.g. "spike__chess_create_game" → "chess_create_game"),
 * then extracts the prefix before the first underscore (e.g. "chess").
 */
export function extractPrefix(
  namespacedName: string,
  serverName: string,
  separator: string = "__",
): string {
  // Strip server namespace prefix
  let toolName = namespacedName;
  const nsPrefix = serverName + separator;
  if (toolName.startsWith(nsPrefix)) {
    toolName = toolName.slice(nsPrefix.length);
  }

  // Extract prefix: everything before the first underscore
  const underscoreIndex = toolName.indexOf("_");
  if (underscoreIndex === -1) return toolName;
  return toolName.slice(0, underscoreIndex);
}

/**
 * Group tools by their inferred prefix.
 */
export function groupToolsByPrefix(
  tools: NamespacedTool[],
  separator: string = "__",
): Map<string, ToolGroup> {
  const groups = new Map<string, ToolGroup>();

  for (const tool of tools) {
    const prefix = extractPrefix(
      tool.namespacedName,
      tool.serverName,
      separator,
    );
    const group = groups.get(prefix);
    if (group) {
      group.tools.push(tool);
    } else {
      groups.set(prefix, { prefix, tools: [tool] });
    }
  }

  return groups;
}

/**
 * Group tools by app from the AppRegistry, falling back to prefix for unmatched tools.
 */
export function groupToolsByApp(
  tools: NamespacedTool[],
  appRegistry: AppRegistry,
  separator: string = "__",
): Map<string, AppToolGroup> {
  const groups = new Map<string, AppToolGroup>();

  for (const tool of tools) {
    // Strip namespace to get original tool name for registry lookup
    const stripped = stripNamespace(
      tool.namespacedName,
      tool.serverName,
      separator,
    );
    const app = appRegistry.getAppForTool(stripped)
      ?? appRegistry.getAppForTool(tool.originalName);

    const key = app
      ? app.slug
      : extractPrefix(tool.namespacedName, tool.serverName, separator);
    const group = groups.get(key);
    if (group) {
      group.tools.push(tool);
    } else {
      groups.set(key, { key, app: app ?? null, tools: [tool], hiddenCount: 0 });
    }
  }

  return groups;
}

/**
 * Determine if a tool is an entry-point (always visible) vs dependent (conditionally visible).
 * Entry-point tools: contain "create", "list", "search", "get_status", or have zero required params.
 */
export function isEntryPointTool(tool: NamespacedTool): boolean {
  const name = tool.namespacedName.toLowerCase();
  const entryKeywords = ["create", "list", "search", "get_status", "bootstrap"];

  for (const keyword of entryKeywords) {
    if (name.includes(keyword)) return true;
  }

  // Tools with zero required params are also entry points
  const required = (tool.inputSchema.required as string[] | undefined) ?? [];
  return required.length === 0;
}

/**
 * Check if a tool is a dependent tool (requires a prior create call).
 * Dependent tools have required params ending in `_id`.
 */
function isDependentTool(tool: NamespacedTool): boolean {
  const required = (tool.inputSchema.required as string[] | undefined) ?? [];
  return required.some(param => param.endsWith("_id"));
}

/**
 * Get required ID params for a tool (params ending in `_id`).
 */
function getRequiredIdParams(tool: NamespacedTool): string[] {
  const required = (tool.inputSchema.required as string[] | undefined) ?? [];
  return required.filter(p => p.endsWith("_id"));
}

/**
 * Check if a tool requires a config prerequisite that hasn't been called yet.
 */
function isBlockedByConfig(
  tool: NamespacedTool,
  sessionState: SessionState,
  separator: string = "__",
): boolean {
  const stripped = stripNamespace(
    tool.namespacedName,
    tool.serverName,
    separator,
  );
  for (const [configTool, dependents] of Object.entries(CONFIG_PREREQUISITES)) {
    if (
      dependents.includes(stripped)
      && !sessionState.hasConfigBeenCalled(configTool)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Filter tools to show only visible ones based on session state.
 * Entry-point tools are always visible. Dependent tools are visible only if
 * a matching create tool has been called in this session.
 */
export function getVisibleTools(
  tools: NamespacedTool[],
  sessionState: SessionState,
  separator: string = "__",
): { visible: NamespacedTool[]; hidden: number; } {
  const visible: NamespacedTool[] = [];
  let hidden = 0;

  for (const tool of tools) {
    if (isEntryPointTool(tool)) {
      visible.push(tool);
    } else if (isDependentTool(tool)) {
      const prefix = extractPrefix(
        tool.namespacedName,
        tool.serverName,
        separator,
      );
      if (sessionState.hasCreated(prefix)) {
        visible.push(tool);
      } else {
        hidden++;
      }
    } else {
      visible.push(tool);
    }
  }

  return { visible, hidden };
}

/**
 * Enhanced visibility filter using ID-level tracking and config prerequisites.
 */
export function getVisibleToolsEnhanced(
  tools: NamespacedTool[],
  sessionState: SessionState,
  separator: string = "__",
): { visible: NamespacedTool[]; hidden: number; } {
  const visible: NamespacedTool[] = [];
  let hidden = 0;

  for (const tool of tools) {
    // Config-dependent tools: hidden until prerequisite called
    if (isBlockedByConfig(tool, sessionState, separator)) {
      hidden++;
      continue;
    }

    if (isEntryPointTool(tool)) {
      visible.push(tool);
    } else if (isDependentTool(tool)) {
      // Check if ALL required ID params have been seen
      const requiredIds = getRequiredIdParams(tool);
      const allIdsSatisfied = requiredIds.every(p => sessionState.hasId(p));

      if (allIdsSatisfied) {
        visible.push(tool);
      } else {
        // Fall back to prefix-based check
        const prefix = extractPrefix(
          tool.namespacedName,
          tool.serverName,
          separator,
        );
        if (sessionState.hasCreated(prefix)) {
          visible.push(tool);
        } else {
          hidden++;
        }
      }
    } else {
      visible.push(tool);
    }
  }

  return { visible, hidden };
}

/** Strip the server namespace prefix from a tool name for display. */
function stripNamespace(
  namespacedName: string,
  serverName: string,
  separator: string = "__",
): string {
  const nsPrefix = serverName + separator;
  if (namespacedName.startsWith(nsPrefix)) {
    return namespacedName.slice(nsPrefix.length);
  }
  return namespacedName;
}

/**
 * Format the /tools output, grouped by prefix with visibility filtering.
 */
function formatGroupedTools(
  tools: NamespacedTool[],
  sessionState: SessionState,
  filterPrefix?: string,
  separator: string = "__",
): string {
  const groups = groupToolsByPrefix(tools, separator);
  const lines: string[] = [];

  for (const [prefix, group] of groups) {
    if (filterPrefix && prefix !== filterPrefix) continue;

    const { visible, hidden } = getVisibleTools(
      group.tools,
      sessionState,
      separator,
    );

    // Server label
    const serverName = group.tools[0]?.serverName ?? "unknown";
    lines.push(`${bold(serverName)} ${dim(`(${prefix})`)}`);

    // Visible tools
    for (const tool of visible) {
      const displayName = stripNamespace(
        tool.namespacedName,
        tool.serverName,
        separator,
      );
      const defaults = extractDefaults(tool.inputSchema);
      const requiredParams = getRequiredParams(tool.inputSchema);

      let hint = "";
      if (Object.keys(defaults).length > 0) {
        const defaultHints = Object.entries(defaults)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(", ");
        hint = ` [${defaultHints}]`;
      }
      if (requiredParams.length > 0) {
        const reqHints = requiredParams.map(p => `${p.name} required`).join(
          ", ",
        );
        hint += hint ? ` [${reqHints}]` : ` [${reqHints}]`;
      }

      lines.push(
        `  ${cyan("/" + displayName)}  ${dim(tool.description ?? "")}${dim(hint)}`,
      );
    }

    if (hidden > 0) {
      lines.push(
        `    ${dim(`+ ${hidden} more (use entry-point tools first)`)}`,
      );
    }

    lines.push("");
  }

  if (filterPrefix && lines.length === 0) {
    return `No tools found for prefix "${filterPrefix}".`;
  }

  return lines.join("\n").trimEnd();
}

/**
 * Format the /tools output using app-based grouping.
 */
function formatAppGroupedTools(
  tools: NamespacedTool[],
  sessionState: SessionState,
  appRegistry: AppRegistry,
  filter?: string,
  separator: string = "__",
): string {
  const groups = groupToolsByApp(tools, appRegistry, separator);
  const lines: string[] = [];

  for (const [key, group] of groups) {
    // Apply filter: match on app slug, app name, category, or prefix key
    if (filter) {
      const f = filter.toLowerCase();
      const matchesKey = key.toLowerCase().includes(f);
      const matchesAppName = group.app?.name.toLowerCase().includes(f) ?? false;
      const matchesCategory = group.app?.category.toLowerCase().includes(f)
        ?? false;
      if (!matchesKey && !matchesAppName && !matchesCategory) continue;
    }

    const { visible, hidden } = getVisibleToolsEnhanced(
      group.tools,
      sessionState,
      separator,
    );
    group.hiddenCount = hidden;

    if (group.app) {
      // App-based header
      lines.push(`${bold(group.app.name)} ${dim(`[${group.app.category}]`)}`);
      lines.push(`  ${dim(group.app.tagline)}`);
    } else {
      // Prefix-based fallback header
      const serverName = group.tools[0]?.serverName ?? "unknown";
      lines.push(`${bold(serverName)} ${dim(`(${key})`)}`);
    }

    for (const tool of visible) {
      const displayName = stripNamespace(
        tool.namespacedName,
        tool.serverName,
        separator,
      );
      const defaults = extractDefaults(tool.inputSchema);
      const requiredParams = getRequiredParams(tool.inputSchema);

      const hasAllDefaults = requiredParams.length === 0
        && Object.keys(defaults).length >= 0;
      const readyBadge = hasAllDefaults ? dim(" (ready)") : "";

      lines.push(
        `  ${cyan("/" + displayName)}${readyBadge}  ${dim(tool.description ?? "")}`,
      );
    }

    if (hidden > 0) {
      lines.push(
        `    ${dim(`+ ${hidden} more (use entry-point tools first)`)}`,
      );
    }

    lines.push("");
  }

  if (filter && lines.length === 0) {
    return `No tools found for "${filter}".`;
  }

  return lines.join("\n").trimEnd();
}

/**
 * Format the /apps listing output.
 */
function formatAppsList(appRegistry: AppRegistry): string {
  const apps = appRegistry.getAllApps();
  if (apps.length === 0) {
    return "No apps registered.";
  }

  const lines: string[] = [bold("Apps:")];
  for (const app of apps) {
    lines.push(
      `  ${bold(app.name)} ${dim(`(${app.slug})`)} ${dim(`[${app.category}]`)} ${dim("—")} ${
        dim(app.tagline)
      }`,
    );
  }
  return lines.join("\n");
}

/**
 * Prompt the user interactively for a parameter value.
 */
async function promptForParam(
  rl: ReadlineInterface,
  param: { name: string; description: string; type: string; },
): Promise<string> {
  return new Promise(resolve => {
    const hint = param.description ? ` (${param.description})` : "";
    const typeHint = param.type !== "string" ? ` [${param.type}]` : "";
    rl.question(
      `  ${bold(param.name)}${dim(hint)}${dim(typeHint)}: `,
      answer => {
        resolve(answer.trim());
      },
    );
  });
}

/**
 * Coerce a string value to the appropriate JS type based on the schema type.
 */
function coerceValue(value: string, type: string): unknown {
  switch (type) {
    case "number":
    case "integer":
      return Number(value);
    case "boolean":
      return value.toLowerCase() === "true" || value === "1";
    case "array":
    case "object":
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      return value;
  }
}

/**
 * Try to extract IDs from a tool result for session state tracking.
 * Looks for common ID fields in JSON results.
 */
function extractIdsFromResult(result: string): string[] {
  try {
    const parsed = JSON.parse(result);
    const ids: string[] = [];
    const idKeys = ["id", "game_id", "player_id", "app_id", "session_id"];
    for (const key of idKeys) {
      if (typeof parsed[key] === "string") {
        ids.push(parsed[key]);
      }
    }
    return ids;
  } catch {
    return [];
  }
}

/** Built-in command names that don't map to tool invocations. */
const BUILTIN_COMMANDS = new Set([
  "tools",
  "apps",
  "servers",
  "clear",
  "model",
  "help",
  "quit",
  "exit",
]);

/**
 * Handle a slash command. Returns a SlashCommandResult.
 */
export async function handleSlashCommand(
  input: string,
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const { command, argsRaw } = parseSlashInput(input);

  // Built-in commands
  if (BUILTIN_COMMANDS.has(command)) {
    return handleBuiltinCommand(command, argsRaw, ctx);
  }

  // Direct tool invocation
  return handleDirectToolCall(command, argsRaw, ctx);
}

function handleBuiltinCommand(
  command: string,
  argsRaw: string,
  ctx: SlashCommandContext,
): SlashCommandResult {
  const { manager, client, messages, sessionState, appRegistry } = ctx;

  switch (command) {
    case "tools": {
      const tools = manager.getAllTools();
      if (tools.length === 0) {
        return { output: "No tools available.", exit: false, cleared: false };
      }

      const filter = argsRaw || undefined;

      // Use app-grouped display when registry is available and has apps
      if (appRegistry && appRegistry.getAllApps().length > 0) {
        const output = formatAppGroupedTools(
          tools,
          sessionState,
          appRegistry,
          filter,
        );
        return { output, exit: false, cleared: false };
      }

      // Fallback to prefix-grouped display
      const output = formatGroupedTools(tools, sessionState, filter);
      return { output, exit: false, cleared: false };
    }

    case "apps": {
      if (!appRegistry) {
        return {
          output: "No app registry available.",
          exit: false,
          cleared: false,
        };
      }
      const output = formatAppsList(appRegistry);
      return { output, exit: false, cleared: false };
    }

    case "servers": {
      const names = manager.getServerNames();
      if (names.length === 0) {
        return { output: "No servers connected.", exit: false, cleared: false };
      }
      const lines = names.map(name => {
        const count = manager.getServerTools(name).length;
        return `  ${bold(name)} (${count} tools)`;
      });
      return {
        output: `${bold("Servers:")}\n${lines.join("\n")}`,
        exit: false,
        cleared: false,
      };
    }

    case "clear":
      messages.length = 0;
      return { output: "Conversation cleared.", exit: false, cleared: true };

    case "model":
      if (argsRaw) {
        return {
          output: `Model is fixed for this session: ${client.model}`,
          exit: false,
          cleared: false,
        };
      }
      return {
        output: `Current model: ${bold(client.model)}`,
        exit: false,
        cleared: false,
      };

    case "help":
      return {
        output: `${bold("Commands:")}
  ${cyan("/tools")}${dim(" [filter]")}  List tools (filter by app, prefix, or category)
  ${cyan("/apps")}          List registered store apps
  ${cyan("/servers")}       List connected servers
  ${cyan("/clear")}         Clear conversation history
  ${cyan("/model")}         Show current model
  ${cyan("/help")}          Show this help
  ${cyan("/quit")}          Exit

${bold("Direct tool invocation:")}
  ${cyan("/<tool_name>")}${dim(" [json-args]")}  Invoke an MCP tool directly
  ${dim("  Example: /chess_create_game {\"time_control\": \"RAPID_10\"}")}
  ${dim("  Defaults from schema are applied automatically")}
  ${dim("  IDs from previous results are auto-filled")}
  ${dim("  Fuzzy matching resolves partial names")}`,
        exit: false,
        cleared: false,
      };

    case "quit":
    case "exit":
      return { output: "", exit: true, cleared: false };

    default:
      return {
        output: `Unknown command: /${command}`,
        exit: false,
        cleared: false,
      };
  }
}

async function handleDirectToolCall(
  command: string,
  argsRaw: string,
  ctx: SlashCommandContext,
): Promise<SlashCommandResult> {
  const { manager, sessionState, rl } = ctx;
  const allTools = manager.getAllTools();

  // Resolve tool by exact match or fuzzy match
  const resolved = resolveToolName(command, allTools);
  if (!resolved) {
    return {
      output: `${yellow("No matching tool found for:")} /${command}\nType ${
        dim("/tools")
      } to see available tools.`,
      exit: false,
      cleared: false,
    };
  }

  const tool = resolved;
  const schema = tool.inputSchema;

  // Parse user-supplied JSON args
  let userArgs: Record<string, unknown> = {};
  if (argsRaw) {
    try {
      userArgs = JSON.parse(argsRaw);
    } catch {
      return {
        output: `${
          yellow("Invalid JSON args:")
        } ${argsRaw}\nExpected format: /tool_name {"key": "value"}`,
        exit: false,
        cleared: false,
      };
    }
  }

  // Merge defaults with user args
  const defaults = extractDefaults(schema);
  const mergedArgs: Record<string, unknown> = { ...defaults, ...userArgs };

  // Auto-fill ID params from session state
  const required = (schema.required as string[] | undefined) ?? [];
  const autoFilled: string[] = [];
  for (const paramName of required) {
    if (paramName in mergedArgs && mergedArgs[paramName] !== undefined) {
      continue;
    }
    if (paramName.endsWith("_id") || paramName === "id") {
      const latestId = sessionState.getLatestId(paramName);
      if (latestId) {
        mergedArgs[paramName] = latestId;
        autoFilled.push(`${paramName}=${latestId}`);
      }
    }
  }

  if (autoFilled.length > 0) {
    console.error(dim(`  auto-filled ${autoFilled.join(", ")}`));
  }

  // Check for missing required params
  const missingParams = getRequiredParams(schema).filter(
    p => !(p.name in mergedArgs) || mergedArgs[p.name] === undefined,
  );

  // If we have a readline interface and missing params, prompt interactively
  if (missingParams.length > 0 && rl) {
    console.error(
      dim(`\nMissing required parameters for ${tool.namespacedName}:`),
    );
    for (const param of missingParams) {
      const value = await promptForParam(rl, param);
      if (!value) {
        return {
          output: `${yellow("Cancelled:")} missing required parameter "${param.name}"`,
          exit: false,
          cleared: false,
        };
      }
      mergedArgs[param.name] = coerceValue(value, param.type);
    }
  } else if (missingParams.length > 0) {
    // No readline available, show usage
    const paramList = missingParams
      .map(p => `  ${bold(p.name)} (${p.type})${p.description ? ": " + p.description : ""}`)
      .join("\n");
    return {
      output: `${yellow("Missing required parameters:")}\n${paramList}\n\nUsage: /${command} {"${
        missingParams[0].name
      }": "value"}`,
      exit: false,
      cleared: false,
    };
  }

  // Execute the tool
  console.error(dim(`\n[calling ${tool.namespacedName}...]`));
  const { result, isError } = await executeToolCall(
    manager,
    tool.namespacedName,
    mergedArgs,
  );

  // Track IDs in session state from result
  if (!isError) {
    sessionState.recordIds(result);
  }

  // Track config tools in session state
  const strippedName = stripNamespace(tool.namespacedName, tool.serverName);
  if (strippedName in CONFIG_PREREQUISITES) {
    sessionState.recordConfigCall(strippedName);
  }

  // Track create tools in session state
  const prefix = extractPrefix(tool.namespacedName, tool.serverName);
  if (
    tool.namespacedName.includes("create")
    || tool.namespacedName.includes("bootstrap")
  ) {
    const ids = extractIdsFromResult(result);
    if (ids.length > 0) {
      sessionState.recordCreate(prefix, ids);
    } else {
      // Even without IDs, record that a create was called
      sessionState.recordCreate(prefix, ["_created"]);
    }
  }

  // Format output
  const status = isError ? yellow("Error") : green("OK");
  let formattedResult: string;
  try {
    const parsed = JSON.parse(result);
    formattedResult = JSON.stringify(parsed, null, 2);
  } catch {
    formattedResult = result;
  }

  return {
    output: `${status} ${dim(tool.namespacedName)}\n${formattedResult}`,
    exit: false,
    cleared: false,
  };
}

/**
 * Resolve a command string to a NamespacedTool.
 * First tries exact match (with or without namespace), then fuzzy match.
 * Auto-executes best fuzzy match if it's significantly better than runner-up (2x score gap).
 */
function resolveToolName(
  command: string,
  tools: NamespacedTool[],
): NamespacedTool | null {
  // Exact match on namespacedName
  const exact = tools.find(t => t.namespacedName === command);
  if (exact) return exact;

  // Exact match on original name
  const exactOriginal = tools.find(t => t.originalName === command);
  if (exactOriginal) return exactOriginal;

  // Exact match stripping namespace prefix
  const exactStripped = tools.find(t => {
    const stripped = stripNamespace(t.namespacedName, t.serverName);
    return stripped === command;
  });
  if (exactStripped) return exactStripped;

  // Fuzzy match
  const fuzzyResults = fuzzyFilter(command, tools, t => {
    const stripped = stripNamespace(t.namespacedName, t.serverName);
    return stripped;
  });

  if (fuzzyResults.length === 0) return null;

  if (fuzzyResults.length === 1) return fuzzyResults[0];

  // Auto-execute if best match is significantly better (2x score gap)
  const bestScore = fuzzyScore(
    command,
    stripNamespace(fuzzyResults[0].namespacedName, fuzzyResults[0].serverName),
  );
  const runnerUpScore = fuzzyScore(
    command,
    stripNamespace(fuzzyResults[1].namespacedName, fuzzyResults[1].serverName),
  );

  if (bestScore >= runnerUpScore * 2) {
    return fuzzyResults[0];
  }

  // Ambiguous — still return best match with a note logged
  return fuzzyResults[0];
}

/**
 * Hook for the agent loop to track tool calls and update session state.
 * Call this from onToolCallEnd in the agent loop.
 */
export function trackToolCallForSession(
  toolName: string,
  result: string,
  isError: boolean,
  allTools: NamespacedTool[],
  sessionState: SessionState,
): void {
  if (isError) return;

  const tool = allTools.find(t => t.namespacedName === toolName);
  if (!tool) return;

  // Record IDs from result
  sessionState.recordIds(result);

  // Track config tools
  const stripped = stripNamespace(toolName, tool.serverName);
  if (stripped in CONFIG_PREREQUISITES) {
    sessionState.recordConfigCall(stripped);
  }

  if (toolName.includes("create") || toolName.includes("bootstrap")) {
    const prefix = extractPrefix(toolName, tool.serverName);
    const ids = extractIdsFromResult(result);
    if (ids.length > 0) {
      sessionState.recordCreate(prefix, ids);
    } else {
      sessionState.recordCreate(prefix, ["_created"]);
    }
  }
}
