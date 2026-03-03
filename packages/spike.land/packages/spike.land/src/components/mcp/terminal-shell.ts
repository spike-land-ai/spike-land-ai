// Command interpreter for the MCP terminal.
// Pure logic — no React, no DOM, no xterm import.
// Communicates via callbacks.

import type {
  McpCategory,
  McpSuperCategory,
  McpToolDef,
} from "@/components/mcp/mcp-tool-registry";
import {
  c,
  formatError,
  formatGeneralHelp,
  formatHistory,
  formatSearchResults,
  formatSuccess,
  formatToolHelp,
  formatToolList,
  PROMPT,
  SPINNER_FRAMES,
} from "./terminal-formatter";

// ── Types ────────────────────────────────────────────────────────────

export interface ShellCallbacks {
  /** Write string to terminal (may contain ANSI) */
  write: (data: string) => void;
  /** Clear terminal screen */
  clear: () => void;
  /** Execute an MCP tool call — returns the JSON response */
  executeTool: (
    toolName: string,
    params: Record<string, unknown>,
  ) => Promise<unknown>;
  /** Called when an image URL is detected in a response */
  onImageUrl?: (url: string) => void;
}

export interface ShellOptions {
  tools: McpToolDef[];
  categories: McpCategory[];
  superCategories?: McpSuperCategory[];
}

// ── Shell state ──────────────────────────────────────────────────────

export class TerminalShell {
  private line = "";
  private cursorPos = 0;
  private history: string[] = [];
  private historyIdx = -1;
  private historyDraft = "";
  private executing = false;
  private spinnerTimer: ReturnType<typeof setInterval> | null = null;

  private tools: McpToolDef[];
  private categories: McpCategory[];
  private superCategories: McpSuperCategory[];
  private toolNames: string[];
  private toolsByCategory: Record<
    string,
    Array<{ name: string; description: string; }>
  >;

  private cb: ShellCallbacks;

  constructor(callbacks: ShellCallbacks, options: ShellOptions) {
    this.cb = callbacks;
    this.tools = options.tools;
    this.categories = options.categories.filter(cat => cat.toolCount > 0);
    this.superCategories = options.superCategories ?? [];
    this.toolNames = this.tools.map(t => t.name).sort();

    // Group tools by category for list display
    this.toolsByCategory = {};
    for (const tool of this.tools) {
      if (!this.toolsByCategory[tool.category]) {
        this.toolsByCategory[tool.category] = [];
      }
      this.toolsByCategory[tool.category]!.push({
        name: tool.name,
        description: tool.description,
      });
    }
  }

  // ── Handle raw input from xterm onData ─────────────────────────────

  handleInput(data: string): void {
    if (this.executing) return;

    for (let i = 0; i < data.length; i++) {
      const ch = data[i];

      // ESC sequences (arrows, etc.)
      if (ch === "\x1b" && data[i + 1] === "[") {
        const code = data[i + 2];
        if (code === "A") {
          this.historyUp();
          i += 2;
          continue;
        } // Up
        if (code === "B") {
          this.historyDown();
          i += 2;
          continue;
        } // Down
        if (code === "C") {
          this.cursorRight();
          i += 2;
          continue;
        } // Right
        if (code === "D") {
          this.cursorLeft();
          i += 2;
          continue;
        } // Left
        // Home/End
        if (code === "H") {
          this.cursorHome();
          i += 2;
          continue;
        }
        if (code === "F") {
          this.cursorEnd();
          i += 2;
          continue;
        }
        i += 2;
        continue;
      }

      if (ch === "\r" || ch === "\n") {
        this.submit();
      } else if (ch === "\x7f" || ch === "\b") {
        this.backspace();
      } else if (ch === "\t") {
        this.tabComplete();
      } else if (ch === "\x03") {
        // Ctrl+C
        this.line = "";
        this.cursorPos = 0;
        this.cb.write("^C\r\n");
        this.cb.write(PROMPT);
      } else if (ch === "\x15") {
        // Ctrl+U — clear line
        this.clearLine();
        this.line = "";
        this.cursorPos = 0;
        this.cb.write(PROMPT);
      } else if (ch && ch >= " ") {
        this.insertChar(ch);
      }
    }
  }

  // ── Inject a command (e.g. from sidebar click) ─────────────────────

  injectCommand(cmd: string): void {
    if (this.executing) return;
    this.clearLine();
    this.line = cmd;
    this.cursorPos = cmd.length;
    this.cb.write(PROMPT + cmd);
    this.submit();
  }

  // ── Private: line editing ──────────────────────────────────────────

  private insertChar(ch: string): void {
    if (this.cursorPos === this.line.length) {
      this.line += ch;
      this.cursorPos++;
      this.cb.write(ch);
    } else {
      // Insert in middle
      this.line = this.line.slice(0, this.cursorPos) + ch
        + this.line.slice(this.cursorPos);
      this.cursorPos++;
      this.redrawLine();
    }
  }

  private backspace(): void {
    if (this.cursorPos === 0) return;
    this.line = this.line.slice(0, this.cursorPos - 1)
      + this.line.slice(this.cursorPos);
    this.cursorPos--;
    this.redrawLine();
  }

  private cursorLeft(): void {
    if (this.cursorPos > 0) {
      this.cursorPos--;
      this.cb.write("\x1b[D");
    }
  }

  private cursorRight(): void {
    if (this.cursorPos < this.line.length) {
      this.cursorPos++;
      this.cb.write("\x1b[C");
    }
  }

  private cursorHome(): void {
    while (this.cursorPos > 0) {
      this.cursorPos--;
      this.cb.write("\x1b[D");
    }
  }

  private cursorEnd(): void {
    while (this.cursorPos < this.line.length) {
      this.cursorPos++;
      this.cb.write("\x1b[C");
    }
  }

  private clearLine(): void {
    // Move cursor to start of prompt, clear line
    this.cb.write(`\r\x1b[2K`);
  }

  private redrawLine(): void {
    this.clearLine();
    this.cb.write(PROMPT + this.line);
    // Position cursor correctly
    const back = this.line.length - this.cursorPos;
    if (back > 0) {
      this.cb.write(`\x1b[${back}D`);
    }
  }

  // ── Private: history ───────────────────────────────────────────────

  private historyUp(): void {
    if (this.history.length === 0) return;
    if (this.historyIdx === -1) {
      this.historyDraft = this.line;
      this.historyIdx = this.history.length - 1;
    } else if (this.historyIdx > 0) {
      this.historyIdx--;
    } else {
      return;
    }
    this.line = this.history[this.historyIdx] ?? "";
    this.cursorPos = this.line.length;
    this.redrawLine();
  }

  private historyDown(): void {
    if (this.historyIdx === -1) return;
    if (this.historyIdx < this.history.length - 1) {
      this.historyIdx++;
      this.line = this.history[this.historyIdx] ?? "";
    } else {
      this.historyIdx = -1;
      this.line = this.historyDraft;
    }
    this.cursorPos = this.line.length;
    this.redrawLine();
  }

  // ── Private: tab completion ────────────────────────────────────────

  private tabComplete(): void {
    const prefix = this.line.slice(0, this.cursorPos);
    // Only complete the first word (tool name)
    if (prefix.includes(" ")) return;

    const matches = this.toolNames.filter(n => n.startsWith(prefix));
    if (matches.length === 0) return;

    if (matches.length === 1) {
      const completion = matches[0]!;
      this.line = completion + " ";
      this.cursorPos = this.line.length;
      this.redrawLine();
    } else {
      // Show matches
      this.cb.write("\r\n");
      const maxPerRow = 4;
      const colWidth = 28;
      for (let i = 0; i < matches.length; i += maxPerRow) {
        const row = matches.slice(i, i + maxPerRow);
        this.cb.write(
          "  " + row.map(m => c.green(m.padEnd(colWidth))).join("") + "\r\n",
        );
      }
      this.cb.write(PROMPT + this.line);
      // Re-position cursor
      const back = this.line.length - this.cursorPos;
      if (back > 0) this.cb.write(`\x1b[${back}D`);

      // Find longest common prefix
      const lcp = longestCommonPrefix(matches);
      if (lcp.length > prefix.length) {
        this.line = lcp + this.line.slice(this.cursorPos);
        this.cursorPos = lcp.length;
        this.redrawLine();
      }
    }
  }

  // ── Private: submit command ────────────────────────────────────────

  private submit(): void {
    const cmd = this.line.trim();
    this.cb.write("\r\n");

    // Reset line state
    this.line = "";
    this.cursorPos = 0;
    this.historyIdx = -1;
    this.historyDraft = "";

    if (!cmd) {
      this.cb.write(PROMPT);
      return;
    }

    // Add to history
    if (this.history[this.history.length - 1] !== cmd) {
      this.history.push(cmd);
    }

    this.runCommand(cmd);
  }

  // ── Private: command dispatch ──────────────────────────────────────

  private runCommand(raw: string): void {
    const parts = raw.match(/^(\S+)(?:\s+(.*))?$/);
    if (!parts) {
      this.cb.write(PROMPT);
      return;
    }

    const command = parts[1]!.toLowerCase();
    const args = parts[2]?.trim() ?? "";

    switch (command) {
      case "help":
        this.cmdHelp(args);
        break;
      case "list":
      case "ls":
        this.cmdList(args);
        break;
      case "search":
        this.cmdSearch(args);
        break;
      case "clear":
        this.cb.clear();
        break;
      case "history":
        this.cb.write(formatHistory(this.history));
        this.cb.write(PROMPT);
        break;
      default:
        this.cmdTool(command, args);
        return; // cmdTool handles its own prompt (async)
    }
  }

  private cmdHelp(args: string): void {
    if (!args) {
      this.cb.write(formatGeneralHelp());
      this.cb.write(PROMPT);
      return;
    }

    const tool = this.tools.find(t => t.name === args || t.name === args.toLowerCase());
    if (tool) {
      this.cb.write(formatToolHelp(tool));
    } else {
      this.cb.write(
        `\r\n  ${c.yellow(`Unknown tool: "${args}"`)}. Use ${
          c.green("list")
        } to see available tools.\r\n\r\n`,
      );
    }
    this.cb.write(PROMPT);
  }

  private cmdList(args: string): void {
    this.cb.write(
      formatToolList(
        this.categories,
        this.toolsByCategory,
        args || undefined,
        this.superCategories,
      ),
    );
    this.cb.write(PROMPT);
  }

  private cmdSearch(query: string): void {
    if (!query) {
      this.cb.write(`\r\n  ${c.yellow("Usage:")} search <query>\r\n\r\n`);
      this.cb.write(PROMPT);
      return;
    }

    const q = query.toLowerCase();
    const results = this.tools
      .filter(t => t.name.includes(q) || t.description.toLowerCase().includes(q))
      .map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
      }))
      .slice(0, 20);

    this.cb.write(formatSearchResults(query, results));
    this.cb.write(PROMPT);
  }

  private async cmdTool(name: string, argsStr: string): Promise<void> {
    const tool = this.tools.find(t => t.name === name);
    if (!tool) {
      this.cb.write(`\r\n  ${c.red("Unknown command:")} ${c.white(name)}\r\n`);
      this.cb.write(
        `  ${c.dim("Type")} ${c.green("help")} ${c.dim("for available commands, or")} ${
          c.green("search " + name)
        } ${c.dim("to find tools.")}\r\n\r\n`,
      );
      this.cb.write(PROMPT);
      return;
    }

    // Parse params
    const params = parseToolArgs(argsStr, tool);

    // Start spinner
    this.executing = true;
    let frame = 0;
    this.cb.write(
      `  ${c.cyan(SPINNER_FRAMES[0]!)} ${c.dim(`Running ${name}...`)}`,
    );

    this.spinnerTimer = setInterval(() => {
      frame = (frame + 1) % SPINNER_FRAMES.length;
      // Move to start of line, rewrite spinner
      this.cb.write(
        `\r  ${c.cyan(SPINNER_FRAMES[frame]!)} ${c.dim(`Running ${name}...`)}`,
      );
    }, 80);

    const start = Date.now();

    try {
      const result = await this.cb.executeTool(name, params);
      const elapsed = Date.now() - start;

      this.stopSpinner();
      // Clear spinner line
      this.cb.write("\r\x1b[2K");
      this.cb.write(formatSuccess(name, result, elapsed));

      // Check for image URLs in the response
      if (result && typeof result === "object") {
        const imageUrl = extractImageUrl(result as Record<string, unknown>);
        if (imageUrl) {
          this.cb.onImageUrl?.(imageUrl);
        }
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      this.stopSpinner();
      this.cb.write("\r\x1b[2K");
      this.cb.write(
        formatError(
          name,
          err instanceof Error ? err.message : String(err),
          elapsed,
        ),
      );
    }

    this.executing = false;
    this.cb.write(PROMPT);
  }

  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = null;
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function parseToolArgs(
  argsStr: string,
  tool?: McpToolDef,
): Record<string, unknown> {
  if (!argsStr) return {};

  const trimmed = argsStr.trim();
  // Legacy support for pure JSON input
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      // Fall through
    }
  }

  const params: Record<string, unknown> = {};

  // 1. Extract named flags: --key value or --key "quoted value"
  // This regex matches --key followed by either a quoted string (with escaping) or a non-space string
  const flagPattern = /--(\w[\w-]*)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
  let remaining = argsStr;
  let m: RegExpExecArray | null;

  while ((m = flagPattern.exec(argsStr)) !== null) {
    const key = m[1]!;
    let value = m[2]!;

    // Remove the full match from 'remaining' to find positional args later
    remaining = remaining.replace(m[0], " ");

    // Clean up value
    if (
      (value.startsWith("\"") && value.endsWith("\""))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
      // Unescape: \" -> ", \\ -> \, etc.
      value = value.replace(/\\(.)/g, "$1");
    }

    // Try to parse as JSON if it looks like an object or array
    const vTrim = value.trim();
    if (vTrim.startsWith("{") || vTrim.startsWith("[")) {
      try {
        params[key] = JSON.parse(vTrim);
      } catch {
        params[key] = value;
      }
    } else if (value === "true") {
      params[key] = true;
    } else if (value === "false") {
      params[key] = false;
    } else if (/^-?\d+$/.test(value)) {
      params[key] = parseInt(value, 10);
    } else if (/^-?\d+\.\d+$/.test(value)) {
      params[key] = parseFloat(value);
    } else {
      params[key] = value;
    }
  }

  // 2. Positional arguments calculation
  // Find everything that wasn't a flag
  const posPattern = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\S+)/g;
  const positionalValues: unknown[] = [];
  while ((m = posPattern.exec(remaining)) !== null) {
    let val = m[1] as string;
    if (
      (val.startsWith("\"") && val.endsWith("\""))
      || (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).replace(/\\(.)/g, "$1");
    }
    positionalValues.push(val);
  }

  // Map positional values to tool parameters if they aren't already set by flags
  if (tool && tool.params.length > 0) {
    let valIdx = 0;
    for (const p of tool.params) {
      if (params[p.name] === undefined && valIdx < positionalValues.length) {
        const val = positionalValues[valIdx++] as string;
        let finalVal: unknown = val;

        // Try to cast types based on manifest
        if (p.type === "number") {
          const n = parseFloat(val);
          if (!isNaN(n)) finalVal = n;
        } else if (p.type === "boolean") {
          if (val === "true") finalVal = true;
          if (val === "false") finalVal = false;
        } else if (
          typeof val === "string"
          && (val.startsWith("{") || val.startsWith("["))
        ) {
          try {
            finalVal = JSON.parse(val);
          } catch { /* ignore */ }
        }

        params[p.name] = finalVal;
      }
    }
  }

  return params;
}

function extractImageUrl(obj: Record<string, unknown>): string | null {
  for (const key of ["outputImageUrl", "url", "image_url"]) {
    if (typeof obj[key] === "string") {
      try {
        const parsed = new URL(obj[key] as string);
        if (parsed.protocol === "https:" || parsed.protocol === "http:") {
          return parsed.href;
        }
      } catch {
        // invalid URL — skip
      }
    }
  }
  return null;
}

function longestCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return "";
  let prefix = strings[0]!;
  for (let i = 1; i < strings.length; i++) {
    while (!strings[i]!.startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
  }
  return prefix;
}
