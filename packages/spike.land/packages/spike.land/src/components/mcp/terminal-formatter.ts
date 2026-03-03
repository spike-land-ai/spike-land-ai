// ANSI color helpers and output formatting for the MCP terminal.
// Pure functions — no React, no xterm dependency.

import { truncate } from "@/lib/utils";
import type { McpSubcategory, McpSuperCategory } from "./mcp-tool-registry";

// ── ANSI escape codes ────────────────────────────────────────────────
const ESC = "\x1b[";
const RESET = `${ESC}0m`;
const BOLD = `${ESC}1m`;
const DIM = `${ESC}2m`;

const FG = {
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,
} as const;

// ── Public color helpers ─────────────────────────────────────────────
export const c = {
  reset: (s: string) => `${RESET}${s}`,
  bold: (s: string) => `${BOLD}${s}${RESET}`,
  dim: (s: string) => `${DIM}${s}${RESET}`,
  red: (s: string) => `${FG.red}${s}${RESET}`,
  green: (s: string) => `${FG.green}${s}${RESET}`,
  yellow: (s: string) => `${FG.yellow}${s}${RESET}`,
  blue: (s: string) => `${FG.blue}${s}${RESET}`,
  magenta: (s: string) => `${FG.magenta}${s}${RESET}`,
  cyan: (s: string) => `${FG.cyan}${s}${RESET}`,
  white: (s: string) => `${FG.white}${s}${RESET}`,
  gray: (s: string) => `${FG.gray}${s}${RESET}`,
  boldWhite: (s: string) => `${BOLD}${FG.white}${s}${RESET}`,
  dimCyan: (s: string) => `${DIM}${FG.cyan}${s}${RESET}`,
};

// ── Spinner frames ───────────────────────────────────────────────────
export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
];

// ── Prompt ───────────────────────────────────────────────────────────
export const PROMPT = `${FG.green}spike.land ${FG.green}➜${RESET} `;

// ── Welcome banner ───────────────────────────────────────────────────
export function welcomeBanner(): string {
  const lines = [
    "",
    `  ${c.cyan("╔═══════════════════════════════════════════╗")}`,
    `  ${c.cyan("║")}  ${c.boldWhite("spike.land MCP Terminal")}                  ${c.cyan("║")}`,
    `  ${c.cyan("║")}  Type ${c.green("'help'")} to get started               ${c.cyan("║")}`,
    `  ${c.cyan("╚═══════════════════════════════════════════╝")}`,
    "",
  ];
  return lines.join("\r\n");
}

// ── JSON syntax highlighting ─────────────────────────────────────────
export function colorizeJson(data: unknown, indent: number = 2): string {
  const raw = JSON.stringify(data, null, indent);
  if (!raw) return c.gray("undefined");

  // Colorize token by token
  return raw.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g, // keys
    (_, key: string) => `${c.yellow(key)}:`,
  ).replace(
    /:\s*("(?:[^"\\]|\\.)*")/g, // string values
    (match, val: string) => match.replace(val, c.green(val)),
  ).replace(
    /:\s*(\d+(?:\.\d+)?)/g, // numbers
    (match, val: string) => match.replace(val, c.cyan(val)),
  ).replace(
    /:\s*(true|false)/g, // booleans
    (match, val: string) => match.replace(val, c.magenta(val)),
  ).replace(
    /:\s*(null)/g, // null
    (match, val: string) => match.replace(val, c.dim(val)),
  );
}

// ── Format a successful response ─────────────────────────────────────
export function formatSuccess(
  _toolName: string,
  data: unknown,
  elapsedMs: number,
): string {
  const elapsed = (elapsedMs / 1000).toFixed(1);
  const lines = [
    `  ${c.green("✓")} ${c.dim(`Done in ${elapsed}s`)}`,
    "",
  ];

  // Indent each line of JSON output
  const json = colorizeJson(data);
  for (const line of json.split("\n")) {
    lines.push(`  ${line}`);
  }

  lines.push("");
  return lines.join("\r\n");
}

// ── Format an error response ─────────────────────────────────────────
export function formatError(
  _toolName: string,
  message: string,
  elapsedMs: number,
): string {
  const elapsed = (elapsedMs / 1000).toFixed(1);
  return [
    `  ${c.red("✗")} ${c.red("Error")} ${c.dim(`(${elapsed}s)`)}`,
    `  ${c.red(message)}`,
    "",
  ].join("\r\n");
}

// ── Format tool help ─────────────────────────────────────────────────
interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enumValues?: string[];
}

interface ToolInfo {
  name: string;
  displayName: string;
  description: string;
  category: string;
  tier: string;
  params: ToolParam[];
}

export function formatToolHelp(tool: ToolInfo): string {
  const lines = [
    "",
    `  ${c.boldWhite(tool.displayName)} ${c.dim(`(${tool.name})`)}`,
    `  ${c.gray(tool.description)}`,
    "",
  ];

  if (tool.params.length > 0) {
    lines.push(`  ${c.cyan("Parameters:")}`);
    for (const p of tool.params) {
      const req = p.required ? c.red("*") : " ";
      const typeStr = c.dimCyan(p.type);
      lines.push(
        `    ${req} ${c.white(p.name)} ${typeStr} — ${c.gray(p.description)}`,
      );
      if (p.enumValues && p.enumValues.length > 0) {
        lines.push(`      ${c.dim(`values: ${p.enumValues.join(", ")}`)}`);
      }
    }
  } else {
    lines.push(`  ${c.gray("No parameters required.")}`);
  }

  lines.push("");
  lines.push(`  ${c.dim("Usage:")}`);
  if (tool.params.length > 0) {
    const example = tool.params
      .filter(p => p.required)
      .map(p => `--${p.name} "value"`)
      .join(" ");
    lines.push(`    ${c.green(tool.name)} ${example || "--param \"value\""}`);
  } else {
    lines.push(`    ${c.green(tool.name)}`);
  }
  lines.push("");

  return lines.join("\r\n");
}

// ── Format tool list (3-level hierarchy) ─────────────────────────────
interface CategoryInfo {
  id: string;
  name: string;
  toolCount: number;
}

type ToolsByCategory = Record<
  string,
  Array<{ name: string; description: string; }>
>;

export function formatToolList(
  categories: CategoryInfo[],
  toolsByCategory: ToolsByCategory,
  filterCategory?: string,
  superCategories?: McpSuperCategory[],
): string {
  // If we have the 3-level hierarchy and no filter, show the overview
  if (superCategories && superCategories.length > 0 && !filterCategory) {
    return formatSuperCategoryOverview(superCategories);
  }

  // If filter matches a super category
  if (filterCategory && superCategories) {
    const superMatch = superCategories.find(
      s =>
        s.id === filterCategory.toLowerCase()
        || s.name.toLowerCase() === filterCategory.toLowerCase()
        || s.name.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-")
          === filterCategory.toLowerCase(),
    );
    if (superMatch) {
      return formatSuperCategoryDetail(superMatch, toolsByCategory);
    }

    // Check if filter matches a subcategory
    for (const sup of superCategories) {
      const subMatch = sup.subcategories.find(
        s =>
          s.name.toLowerCase() === filterCategory.toLowerCase()
          || s.name.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-")
            === filterCategory.toLowerCase(),
      );
      if (subMatch) {
        return formatSubcategoryDetail(subMatch, toolsByCategory);
      }
    }
  }

  // Fall back to flat category list (backward compat)
  const lines = [""];

  const cats = filterCategory
    ? categories.filter(cat =>
      cat.id === filterCategory
      || cat.name.toLowerCase() === filterCategory.toLowerCase()
    )
    : categories;

  if (cats.length === 0) {
    lines.push(`  ${c.yellow("No matching category found.")}`);
    lines.push("");
    return lines.join("\r\n");
  }

  for (const cat of cats) {
    const tools = toolsByCategory[cat.id] ?? [];
    if (tools.length === 0) continue;

    lines.push(
      `  ${c.boldWhite(cat.name)} ${c.dim(`(${tools.length} tools)`)}`,
    );
    for (const tool of tools) {
      lines.push(
        `    ${c.green(tool.name)} ${c.gray("—")} ${c.dim(truncate(tool.description, 60))}`,
      );
    }
    lines.push("");
  }

  return lines.join("\r\n");
}

function formatSuperCategoryOverview(
  superCategories: McpSuperCategory[],
): string {
  const lines = [""];
  const total = superCategories.reduce((sum, s) => sum + s.toolCount, 0);
  lines.push(
    `  ${c.boldWhite("MCP Tool Categories")} ${c.dim(`(${total} tools)`)}`,
  );
  lines.push("");

  for (const sup of superCategories) {
    lines.push(
      `  ${c.cyan("■")} ${c.boldWhite(sup.name)} ${c.dim(`(${sup.toolCount} tools)`)}`,
    );
    const subNames = sup.subcategories.map(s => s.name).join(", ");
    lines.push(`    ${c.gray(subNames)}`);
  }

  lines.push("");
  lines.push(
    `  ${c.dim("Use")} ${c.green("list <category>")} ${c.dim("to drill into a category")}`,
  );
  lines.push("");

  return lines.join("\r\n");
}

function formatSuperCategoryDetail(
  sup: McpSuperCategory,
  toolsByCategory: ToolsByCategory,
): string {
  const lines = [""];
  lines.push(`  ${c.boldWhite(sup.name)} ${c.dim(`(${sup.toolCount} tools)`)}`);
  lines.push(`  ${c.gray(sup.description)}`);
  lines.push("");

  for (const sub of sup.subcategories) {
    lines.push(
      `  ${c.cyan("▸")} ${c.white(sub.name)} ${c.dim(`(${sub.toolCount} tools)`)}`,
    );
    for (const cat of sub.categories) {
      const tools = toolsByCategory[cat.id] ?? [];
      for (const tool of tools) {
        lines.push(
          `      ${c.green(tool.name)} ${c.gray("—")} ${c.dim(truncate(tool.description, 50))}`,
        );
      }
    }
    lines.push("");
  }

  return lines.join("\r\n");
}

function formatSubcategoryDetail(
  sub: McpSubcategory,
  toolsByCategory: ToolsByCategory,
): string {
  const lines = [""];
  lines.push(`  ${c.boldWhite(sub.name)} ${c.dim(`(${sub.toolCount} tools)`)}`);
  lines.push("");

  for (const cat of sub.categories) {
    const tools = toolsByCategory[cat.id] ?? [];
    if (tools.length === 0) continue;

    lines.push(
      `  ${c.cyan("▸")} ${c.white(cat.name)} ${c.dim(`(${tools.length} tools)`)}`,
    );
    for (const tool of tools) {
      lines.push(
        `      ${c.green(tool.name)} ${c.gray("—")} ${c.dim(truncate(tool.description, 50))}`,
      );
    }
    lines.push("");
  }

  return lines.join("\r\n");
}

// ── Format search results ────────────────────────────────────────────
export function formatSearchResults(
  query: string,
  results: Array<{ name: string; description: string; category: string; }>,
): string {
  const lines = [""];

  if (results.length === 0) {
    lines.push(`  ${c.yellow("No tools matching")} ${c.white(`"${query}"`)}`);
  } else {
    lines.push(
      `  ${c.dim(`${results.length} result${results.length > 1 ? "s" : ""} for`)} ${
        c.white(`"${query}"`)
      }`,
    );
    lines.push("");
    for (const r of results) {
      lines.push(
        `    ${c.green(r.name)} ${c.gray("—")} ${c.dim(truncate(r.description, 50))} ${
          c.dim(`[${r.category}]`)
        }`,
      );
    }
  }

  lines.push("");
  return lines.join("\r\n");
}

// ── General help ─────────────────────────────────────────────────────
export function formatGeneralHelp(): string {
  return [
    "",
    `  ${c.boldWhite("spike.land MCP Terminal")}`,
    "",
    `  ${c.cyan("Commands:")}`,
    `    ${c.green("help")}              ${c.gray("— Show this help")}`,
    `    ${c.green("help <tool>")}       ${c.gray("— Show tool docs and parameters")}`,
    `    ${c.green("list")}              ${c.gray("— List all super categories")}`,
    `    ${c.green("list <category>")}   ${c.gray("— Drill into a category")}`,
    `    ${c.green("search <query>")}    ${c.gray("— Search tools by name/description")}`,
    `    ${c.green("clear")}             ${c.gray("— Clear the terminal")}`,
    `    ${c.green("history")}           ${c.gray("— Show command history")}`,
    "",
    `  ${c.cyan("Tool execution:")}`,
    `    ${c.green("<tool> --flag \"value\"")}     ${c.gray("— CLI-style")}`,
    `    ${c.green("<tool> {\"key\": \"value\"}")}   ${c.gray("— JSON-style")}`,
    "",
    `  ${c.dim("Tip: Use Tab to auto-complete tool names, ↑/↓ for history")}`,
    "",
  ].join("\r\n");
}

// ── Format history ───────────────────────────────────────────────────
export function formatHistory(commands: string[]): string {
  if (commands.length === 0) {
    return `\r\n  ${c.gray("No commands in history.")}\r\n\r\n`;
  }

  const lines = [""];
  for (let i = 0; i < commands.length; i++) {
    lines.push(`  ${c.dim(`${i + 1}`)} ${commands[i]}`);
  }
  lines.push("");
  return lines.join("\r\n");
}
