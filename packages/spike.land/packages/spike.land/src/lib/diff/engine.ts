import type { DiffHunk, FileDiff } from "./types";

/**
 * Computes a basic line-based diff between two strings.
 * For production, this should use a library like 'diff'.
 * This simple version just handles full replacement for now.
 */
export function computeDiff(
  path: string,
  base: string,
  modified: string,
): FileDiff {
  if (base === modified) {
    return { path, type: "modified", hunks: [] };
  }

  const baseLines = base.split("\n");
  const modifiedLines = modified.split("\n");

  const hunk: DiffHunk = {
    oldStart: 1,
    oldLines: baseLines.length,
    newStart: 1,
    newLines: modifiedLines.length,
    lines: [
      ...baseLines.map(l => "-" + l),
      ...modifiedLines.map(l => "+" + l),
    ],
  };

  return {
    path,
    type: "modified",
    hunks: [hunk],
  };
}

/**
 * Parses a unified diff string into FileDiff objects.
 */
export function parseUnifiedDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diffText.split("\n");
  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith("--- ")) continue;
    if (line.startsWith("+++ ")) {
      const path = line.substring(4).trim();
      currentFile = { path, type: "modified", hunks: [] };
      files.push(currentFile);
      currentHunk = null;
    } else if (line.startsWith("@@ ") && currentFile) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1]!, 10),
          oldLines: parseInt(match[2] || "1", 10),
          newStart: parseInt(match[3]!, 10),
          newLines: parseInt(match[4] || "1", 10),
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (
      currentHunk
      && (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))
    ) {
      currentHunk.lines.push(line);
    }
  }

  return files;
}

/**
 * Applies hunks to base content to produce modified content.
 */
export function applyPatch(base: string, hunks: DiffHunk[]): string {
  if (hunks.length === 0) return base;

  const lines = base.split("\n");
  const result: string[] = [];
  let currentLine = 1;

  // Simple sequential patch application
  for (const hunk of hunks) {
    // Add unchanged lines before the hunk
    while (currentLine < hunk.oldStart) {
      result.push(lines[currentLine - 1]!);
      currentLine++;
    }

    // Process hunk lines
    for (const hunkLine of hunk.lines) {
      if (hunkLine.startsWith("+")) {
        result.push(hunkLine.substring(1));
      } else if (hunkLine.startsWith("-")) {
        currentLine++;
      } else if (hunkLine.startsWith(" ")) {
        result.push(hunkLine.substring(1));
        currentLine++;
      }
    }
  }

  // Add remaining lines
  while (currentLine <= lines.length) {
    result.push(lines[currentLine - 1]!);
    currentLine++;
  }

  return result.join("\n");
}

/**
 * Basic three-way merge logic.
 */
export function threeWayMerge(
  base: string,
  ours: string,
  theirs: string,
): { content: string; conflicts: boolean; } {
  if (ours === theirs) return { content: ours, conflicts: false };
  if (ours === base) return { content: theirs, conflicts: false };
  if (theirs === base) return { content: ours, conflicts: false };

  // Fallback: simple conflict markers
  return {
    content: `<<<<<<< OURS\n${ours}\n=======\n${theirs}\n>>>>>>> THEIRS`,
    conflicts: true,
  };
}
