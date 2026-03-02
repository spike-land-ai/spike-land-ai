/**
 * Line Edit Utilities
 *
 * Functions for applying line-based edits and safe regex construction.
 */

import type { LineEdit } from "./types";

// ---------------------------------------------------------------------------
// Regex Safety
// ---------------------------------------------------------------------------

const MAX_REGEX_LENGTH = 500;

/**
 * Create a RegExp from user input with basic ReDoS protection.
 * Rejects patterns that are excessively long or contain known catastrophic
 * backtracking patterns like nested quantifiers: (a+)+, (a*)*
 */
export function safeRegExp(pattern: string, flags?: string): RegExp {
  if (pattern.length > MAX_REGEX_LENGTH) {
    throw new Error(`Regex pattern too long (${pattern.length} chars, max ${MAX_REGEX_LENGTH})`);
  }
  // Reject nested quantifiers that cause catastrophic backtracking
  // Matches patterns like (x+)+, (x*)+, (x+)*, (x{n,})+, etc.
  if (/([+*]|\{\d+,?\})\s*\)[\s]*[+*{]/.test(pattern)) {
    throw new Error(
      "Regex pattern contains nested quantifiers that may cause excessive backtracking",
    );
  }
  return new RegExp(pattern, flags);
}

// ---------------------------------------------------------------------------
// Line Edit Application
// ---------------------------------------------------------------------------

export function applyLineEdits(
  originalCode: string,
  edits: LineEdit[],
): { newCode: string; diff: string } {
  const originalLines = originalCode.split("\n");
  const editsCopy = [...edits].sort((a, b) => b.startLine - a.startLine);

  for (const edit of editsCopy) {
    if (edit.startLine < 1 || edit.endLine < 1) {
      throw new Error("Line numbers must be 1-based and positive");
    }
    if (edit.startLine > edit.endLine) {
      throw new Error("Start line must be less than or equal to end line");
    }
    if (edit.endLine > originalLines.length) {
      throw new Error(
        `End line ${edit.endLine} exceeds code length (${originalLines.length} lines)`,
      );
    }
  }

  const sortedEdits = [...edits].sort((a, b) => a.startLine - b.startLine);
  for (let i = 1; i < sortedEdits.length; i++) {
    const currentEdit = sortedEdits[i];
    const previousEdit = sortedEdits[i - 1];
    if (!currentEdit || !previousEdit) continue;

    if (currentEdit.startLine <= previousEdit.endLine) {
      throw new Error(
        `Overlapping edits detected: lines ${previousEdit.startLine}-${previousEdit.endLine} and ${currentEdit.startLine}-${currentEdit.endLine}`,
      );
    }
  }

  const modifiedLines = [...originalLines];
  const diffParts: string[] = [];

  for (const edit of editsCopy) {
    const startIdx = edit.startLine - 1;
    const endIdx = edit.endLine - 1;
    const removedLines = modifiedLines.slice(startIdx, endIdx + 1);
    const newLines = edit.newContent ? edit.newContent.split("\n") : [];

    const contextStart = Math.max(0, startIdx - 2);
    const contextEnd = Math.min(modifiedLines.length - 1, endIdx + 2);

    const diffHeader = `@@ -${edit.startLine},${
      edit.endLine - edit.startLine + 1
    } +${edit.startLine},${newLines.length} @@`;
    const diffLines = [diffHeader];

    for (let i = contextStart; i < startIdx; i++) {
      diffLines.push(` ${modifiedLines[i]}`);
    }

    for (const line of removedLines) {
      diffLines.push(`-${line}`);
    }

    for (const line of newLines) {
      diffLines.push(`+${line}`);
    }

    for (let i = endIdx + 1; i <= Math.min(contextEnd, modifiedLines.length - 1); i++) {
      diffLines.push(` ${modifiedLines[i]}`);
    }

    diffParts.unshift(diffLines.join("\n"));

    modifiedLines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
  }

  const newCode = modifiedLines.join("\n");
  const diff = diffParts.length > 0 ? diffParts.join("\n\n") : "No changes made";

  return { newCode, diff };
}
