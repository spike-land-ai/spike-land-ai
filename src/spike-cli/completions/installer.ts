/**
 * Shell completion installer — detects shell and manages completion files.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { generateBashCompletions } from "./bash";
import { generateZshCompletions } from "./zsh";
import { generateFishCompletions } from "./fish";

export type ShellType = "bash" | "zsh" | "fish" | "unknown";

export function detectShell(): ShellType {
  const shell = process.env.SHELL ?? "";
  if (shell.endsWith("/zsh")) return "zsh";
  if (shell.endsWith("/bash")) return "bash";
  if (shell.endsWith("/fish")) return "fish";
  return "unknown";
}

export function installCompletions(shell: string): { path: string; instructions: string } {
  const home = homedir();

  switch (shell) {
    case "bash": {
      const dir = join(home, ".spike", "completions");
      const path = join(dir, "spike.bash");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, generateBashCompletions(), "utf-8");

      const rcFile = join(home, ".bashrc");
      const sourceLine = `[ -f "${path}" ] && source "${path}"`;
      appendIfMissing(rcFile, sourceLine);
      logAction(`Installed bash completions to ${path}, modified ${rcFile}`);

      return {
        path,
        instructions: `Completions installed to ${path}.\nSource line added to ~/.bashrc. Run: source ~/.bashrc`,
      };
    }

    case "zsh": {
      const dir = join(home, ".spike", "completions");
      const path = join(dir, "_spike");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, generateZshCompletions(), "utf-8");

      const rcFile = join(home, ".zshrc");
      const fpathLine = `fpath=(${dir} $fpath)`;
      appendIfMissing(rcFile, fpathLine);
      logAction(`Installed zsh completions to ${path}, modified ${rcFile}`);

      return {
        path,
        instructions: `Completions installed to ${path}.\nfpath added to ~/.zshrc. Run: source ~/.zshrc && compinit`,
      };
    }

    case "fish": {
      const dir = join(home, ".config", "fish", "completions");
      const path = join(dir, "spike.fish");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path, generateFishCompletions(), "utf-8");
      logAction(`Installed fish completions to ${path}`);

      return {
        path,
        instructions: `Completions installed to ${path}.\nFish will load them automatically.`,
      };
    }

    default:
      throw new Error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish`);
  }
}

export function uninstallCompletions(shell: string): boolean {
  const home = homedir();

  switch (shell) {
    case "bash": {
      const path = join(home, ".spike", "completions", "spike.bash");
      const removed = removeIfExists(path);
      if (removed) {
        const rcFile = join(home, ".bashrc");
        const sourceLine = `[ -f "${path}" ] && source "${path}"`;
        removeLineFromFile(rcFile, sourceLine);
        logAction(`Uninstalled bash completions: removed ${path} and cleaned ~/.bashrc`);
      }
      return removed;
    }
    case "zsh": {
      const dir = join(home, ".spike", "completions");
      const path = join(dir, "_spike");
      const removed = removeIfExists(path);
      if (removed) {
        const rcFile = join(home, ".zshrc");
        const fpathLine = `fpath=(${dir} $fpath)`;
        removeLineFromFile(rcFile, fpathLine);
        logAction(`Uninstalled zsh completions: removed ${path} and cleaned ~/.zshrc`);
      }
      return removed;
    }
    case "fish": {
      const path = join(home, ".config", "fish", "completions", "spike.fish");
      const removed = removeIfExists(path);
      if (removed) {
        logAction(`Uninstalled fish completions: removed ${path}`);
      }
      return removed;
    }
    default:
      return false;
  }
}

function removeIfExists(path: string): boolean {
  if (existsSync(path)) {
    unlinkSync(path);
    return true;
  }
  return false;
}

function appendIfMissing(filePath: string, line: string): void {
  let content = "";
  if (existsSync(filePath)) {
    content = readFileSync(filePath, "utf-8");
  }
  if (!content.includes(line)) {
    const separator = content.endsWith("\n") || content === "" ? "" : "\n";
    writeFileSync(filePath, content + separator + line + "\n", "utf-8");
  }
}

function removeLineFromFile(filePath: string, line: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  if (!content.includes(line)) return;
  const updated = content
    .split("\n")
    .filter((l) => l !== line)
    .join("\n");
  writeFileSync(filePath, updated, "utf-8");
}

function logAction(message: string): void {
  try {
    const logDir = join(homedir(), ".spike");
    mkdirSync(logDir, { recursive: true });
    const logFile = join(logDir, "install.log");
    const timestamp = new Date().toISOString();
    appendFileSync(logFile, `${timestamp} ${message}\n`, "utf-8");
  } catch {
    // Logging is best-effort
  }
}
