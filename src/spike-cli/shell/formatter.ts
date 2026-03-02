/**
 * ANSI pretty-printing for REPL output.
 */

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const RED = "\x1b[31m";

export function bold(text: string): string {
  return `${BOLD}${text}${RESET}`;
}

export function dim(text: string): string {
  return `${DIM}${text}${RESET}`;
}

export function green(text: string): string {
  return `${GREEN}${text}${RESET}`;
}

export function yellow(text: string): string {
  return `${YELLOW}${text}${RESET}`;
}

export function cyan(text: string): string {
  return `${CYAN}${text}${RESET}`;
}

export function red(text: string): string {
  return `${RED}${text}${RESET}`;
}

export function formatToolList(
  tools: Array<{ name: string; description?: string; }>,
): string {
  if (tools.length === 0) return dim("  (no tools)");

  const maxNameLen = Math.max(...tools.map(t => t.name.length));
  return tools
    .map(t => {
      const padded = t.name.padEnd(maxNameLen + 2);
      return `  ${cyan(padded)}${dim(t.description ?? "")}`;
    })
    .join("\n");
}

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatError(message: string): string {
  return `${red("Error:")} ${message}`;
}

export function formatSuccess(message: string): string {
  return `${green("OK:")} ${message}`;
}
