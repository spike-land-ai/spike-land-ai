export interface ExecutableMdxCommand {
  command: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface ResolvedCommand {
  toolName: string;
  args: Record<string, unknown>;
}

const SHELL_LANGUAGES = new Set(["bash", "shell", "sh", "zsh"]);
const DETAIL_MODES = new Set(["compact", "full", "landmark"]);

export function isExecutableShellLanguage(language?: string): boolean {
  return !!language && SHELL_LANGUAGES.has(language.toLowerCase());
}

export function parseExecutableMdxCommands(block: string): ExecutableMdxCommand[] | null {
  const commands: ExecutableMdxCommand[] = [];

  for (const rawLine of block.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const parsed = parseExecutableMdxCommand(line);
    if (!parsed) return null;
    commands.push(parsed);
  }

  return commands.length > 0 ? commands : null;
}

export function parseExecutableMdxCommand(command: string): ExecutableMdxCommand | null {
  const tokens = tokenizeShellCommand(command);
  if (tokens.length === 0) return null;

  const normalizedTokens = tokens[0] === "$" ? tokens.slice(1) : tokens;
  if (normalizedTokens.length === 0) return null;

  const [name, ...args] = normalizedTokens;

  const resolved =
    resolveAliasCommand(name, args) ??
    resolveKnownToolCommand(name, args) ??
    resolveFlagToolCommand(name, args);

  if (!resolved) return null;

  return {
    command,
    toolName: resolved.toolName,
    args: resolved.args,
  };
}

export const resolveMcpCommandLine = parseExecutableMdxCommand;
export const resolveMcpCommandBlock = parseExecutableMdxCommands;

function resolveAliasCommand(name: string, args: string[]): ResolvedCommand | null {
  switch (name.toLowerCase()) {
    case "open":
    case "goto":
    case "navigate":
    case "visit":
      return args[0]
        ? {
            toolName: "web_navigate",
            args: { url: args[0] },
          }
        : null;

    case "read":
      if (args.length === 0) {
        return { toolName: "web_read", args: {} };
      }

      if (args.length === 1) {
        const value = args[0];
        if (value && DETAIL_MODES.has(value.toLowerCase())) {
          return { toolName: "web_read", args: { detail: value.toLowerCase() } };
        }
        return { toolName: "web_read", args: { landmark: value } };
      }

      if (args.length === 2 && DETAIL_MODES.has(args[1].toLowerCase())) {
        return {
          toolName: "web_read",
          args: {
            landmark: args[0],
            detail: args[1].toLowerCase(),
          },
        };
      }

      return null;

    case "click":
      return resolveRefOrNameTool("web_click", args);

    case "type":
      return resolveTargetAndValueTool("web_type", "text", args);

    case "select":
      return resolveTargetAndValueTool("web_select", "option", args);

    case "press":
      return args[0]
        ? {
            toolName: "web_press",
            args: { key: args.join(" ") },
          }
        : null;

    case "scroll":
      return resolveScrollCommand(args);

    case "tabs":
      return resolveTabsCommand(args);

    case "screenshot":
      if (args[0]?.toLowerCase() === "full") {
        return { toolName: "web_screenshot", args: { full_page: true } };
      }
      return args.length === 0 ? { toolName: "web_screenshot", args: {} } : null;

    case "forms":
      return args.length === 0 ? { toolName: "web_forms", args: {} } : null;

    default:
      return null;
  }
}

function resolveKnownToolCommand(name: string, args: string[]): ResolvedCommand | null {
  if (args.some((arg) => arg.startsWith("--"))) return null;

  switch (name) {
    case "web_navigate":
      return args[0] ? { toolName: name, args: { url: args[0] } } : null;

    case "web_read":
      return resolveAliasCommand("read", args);

    case "web_click":
      return resolveRefOrNameTool(name, args);

    case "web_type":
      return resolveTargetAndValueTool(name, "text", args);

    case "web_select":
      return resolveTargetAndValueTool(name, "option", args);

    case "web_press":
      return args[0] ? { toolName: name, args: { key: args.join(" ") } } : null;

    case "web_scroll":
      return resolveScrollCommand(args);

    case "web_tabs":
      return resolveTabsCommand(args);

    case "web_screenshot":
      return resolveAliasCommand("screenshot", args);

    case "web_forms":
      return args.length === 0 ? { toolName: name, args: {} } : null;

    default:
      return null;
  }
}

function resolveFlagToolCommand(name: string, args: string[]): ResolvedCommand | null {
  if (!name.includes("_") || args.length === 0 || !args.every((arg) => arg.startsWith("--") || !arg.startsWith("-"))) {
    return null;
  }

  const parsedArgs = parseFlagArgs(args);
  return parsedArgs ? { toolName: name, args: parsedArgs } : null;
}

function resolveRefOrNameTool(toolName: string, args: string[]): ResolvedCommand | null {
  const target = args.join(" ").trim();
  if (!target) return null;

  if (isNumericToken(target)) {
    return {
      toolName,
      args: { ref: Number(target) },
    };
  }

  return {
    toolName,
    args: { name: target },
  };
}

function resolveTargetAndValueTool(
  toolName: string,
  valueKey: "text" | "option",
  args: string[],
): ResolvedCommand | null {
  if (args.length < 2) return null;

  const [target, ...valueParts] = args;
  const value = valueParts.join(" ").trim();
  if (!value) return null;

  const baseArgs = isNumericToken(target) ? { ref: Number(target) } : { name: target };

  return {
    toolName,
    args: {
      ...baseArgs,
      [valueKey]: value,
    },
  };
}

function resolveScrollCommand(args: string[]): ResolvedCommand | null {
  if (args.length === 0) {
    return { toolName: "web_scroll", args: {} };
  }

  if (args.length > 2) return null;

  const direction = args[0]?.toLowerCase();
  if (direction !== "up" && direction !== "down") return null;

  if (args.length === 1) {
    return {
      toolName: "web_scroll",
      args: { direction },
    };
  }

  if (!isNumericToken(args[1])) return null;

  return {
    toolName: "web_scroll",
    args: {
      direction,
      amount: Number(args[1]),
    },
  };
}

function resolveTabsCommand(args: string[]): ResolvedCommand | null {
  if (args.length === 0) {
    return { toolName: "web_tabs", args: { action: "list" } };
  }

  const action = args[0]?.toLowerCase();
  if (action !== "list" && action !== "switch" && action !== "close") return null;

  if (action === "list" && args.length === 1) {
    return { toolName: "web_tabs", args: { action } };
  }

  if ((action === "switch" || action === "close") && args.length === 2 && isNumericToken(args[1])) {
    return {
      toolName: "web_tabs",
      args: {
        action,
        tab: Number(args[1]),
      },
    };
  }

  return null;
}

function parseFlagArgs(tokens: string[]): Record<string, unknown> | null {
  const args: Record<string, unknown> = {};

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token?.startsWith("--")) return null;

    const key = token.slice(2).replace(/-/g, "_");
    if (!key) return null;

    const nextToken = tokens[index + 1];
    if (!nextToken || nextToken.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = parseScalar(nextToken);
    index += 1;
  }

  return args;
}

function parseScalar(token: string): string | number | boolean {
  if (token === "true") return true;
  if (token === "false") return false;
  if (isNumericToken(token)) return Number(token);
  return token;
}

function isNumericToken(token: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(token);
}

function tokenizeShellCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (const char of command) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (escaped) current += "\\";
  if (current) tokens.push(current);

  return tokens;
}
