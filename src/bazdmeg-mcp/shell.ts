/**
 * Shell Execution Helper
 *
 * Wraps child_process.execFile for safe, mockable command execution.
 * Uses execFile (not exec) to avoid shell injection.
 */

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ShellResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

/**
 * Run a command via execFile (no shell spawned).
 */
export function runCommand(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ShellResult> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER,
        env: { ...process.env, FORCE_COLOR: "0" },
      },
      (error, stdout, stderr) => {
        const code = error && "code" in error ? (error.code as number) : error ? 1 : 0;
        resolve({
          ok: code === 0,
          stdout: String(stdout),
          stderr: String(stderr),
          code,
        });
      },
    );
  });
}

/**
 * Check if a package.json has a given script.
 */
export async function hasScript(packageDir: string, scriptName: string): Promise<boolean> {
  try {
    const raw = await readFile(join(packageDir, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Boolean(pkg.scripts?.[scriptName]);
  } catch {
    return false;
  }
}
