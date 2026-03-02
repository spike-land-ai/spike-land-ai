/**
 * Simple stderr logger with verbosity control.
 * MCP servers MUST NOT write to stdout (reserved for JSON-RPC).
 */

let verbose = false;

export function setVerbose(v: boolean): void {
  verbose = v;
}

export function isVerbose(): boolean {
  return verbose;
}

export function log(message: string, ...args: unknown[]): void {
  if (verbose) {
    console.error(`[spike] ${message}`, ...args);
  }
}

export function warn(message: string, ...args: unknown[]): void {
  console.error(`[spike WARN] ${message}`, ...args);
}

export function error(message: string, ...args: unknown[]): void {
  console.error(`[spike ERROR] ${message}`, ...args);
}
