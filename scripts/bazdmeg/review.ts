import { execSync } from "node:child_process";
import type { ReviewVerdict } from "./types.js";

export function getChangedFiles(): string[] {
  try {
    // Tracked modified + untracked files
    const tracked = execSync("git diff --name-only", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    const staged = execSync("git diff --cached --name-only", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    const untracked = execSync(
      "git ls-files --others --exclude-standard",
      { encoding: "utf-8", cwd: process.cwd() },
    ).trim();

    const all = new Set<string>();
    for (const line of [tracked, staged, untracked].join("\n").split("\n")) {
      const trimmed = line.trim();
      if (trimmed) all.add(trimmed);
    }
    return [...all];
  } catch {
    return [];
  }
}

export function getPerFileDiffs(files: string[]): string {
  const parts: string[] = [];
  for (const file of files) {
    try {
      // For tracked files, get diff; for untracked, show full content
      let diff: string;
      try {
        diff = execSync(`git diff -- "${file}"`, {
          encoding: "utf-8",
          cwd: process.cwd(),
        }).trim();
      } catch {
        diff = "";
      }
      if (!diff) {
        try {
          diff = execSync(`git diff --cached -- "${file}"`, {
            encoding: "utf-8",
            cwd: process.cwd(),
          }).trim();
        } catch {
          diff = "";
        }
      }
      if (!diff) {
        // Untracked file — show full content
        try {
          const content = execSync(`head -200 "${file}"`, {
            encoding: "utf-8",
            cwd: process.cwd(),
          }).trim();
          diff = `NEW FILE: ${file}\n${content}`;
        } catch {
          continue;
        }
      }
      parts.push(`--- ${file} ---\n${diff}`);
    } catch {
      continue;
    }
  }
  return parts.join("\n\n");
}

export function parseVerdicts(agentOutput: string): ReviewVerdict[] {
  const verdicts: ReviewVerdict[] = [];
  const blocks = agentOutput.split(/(?=FILE:\s)/);

  for (const block of blocks) {
    const fileMatch = block.match(/FILE:\s*(.+)/);
    const verdictMatch = block.match(/VERDICT:\s*(APPROVE|REJECT)/);
    const reasonMatch = block.match(/REASON:\s*(.+)/);

    if (fileMatch && verdictMatch) {
      verdicts.push({
        file: fileMatch[1].trim(),
        verdict: verdictMatch[1].trim() as "APPROVE" | "REJECT",
        reason: reasonMatch ? reasonMatch[1].trim() : "",
      });
    }
  }

  return verdicts;
}

export function commitFiles(files: string[], message: string): void {
  if (files.length === 0) return;
  for (const file of files) {
    execSync(`git add -- "${file}"`, { cwd: process.cwd() });
  }
  // Use -- to prevent message from being interpreted as flags
  const escaped = message.replace(/'/g, "'\\''");
  execSync(`git commit -m '${escaped}'`, { cwd: process.cwd() });
}

export function formatRejectionFeedback(verdicts: ReviewVerdict[]): string {
  return verdicts
    .filter((v) => v.verdict === "REJECT")
    .map((v) => `FILE: ${v.file}\nREJECTION REASON: ${v.reason}`)
    .join("\n\n");
}

export function isWorkingTreeClean(): boolean {
  try {
    const status = execSync("git status --porcelain", {
      encoding: "utf-8",
      cwd: process.cwd(),
    }).trim();
    return status === "";
  } catch {
    return true;
  }
}
