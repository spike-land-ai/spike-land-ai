/**
 * MCP Tool Execution Functions
 *
 * Each function implements one MCP tool's logic against a codespace session.
 */

import { upsertSession } from "@/lib/codespace/session-service";
import { transpileCode } from "@/lib/codespace/transpile";
import type { ICodeSession } from "@/lib/codespace/types";
import logger from "@/lib/logger";

import { applyLineEdits } from "./line-edits";
import { safeRegExp } from "./line-edits";
import type {
  EditCodeResult,
  FindLinesResult,
  LineEdit,
  LineMatch,
  ReadCodeResult,
  ReadHtmlResult,
  ReadSessionResult,
  SearchReplaceResult,
  UpdateCodeResult,
} from "./types";

// ---------------------------------------------------------------------------
// Session Helper
// ---------------------------------------------------------------------------

/**
 * Persist an updated codespace session via force-upsert.
 * This replaces the Durable Object updateAndBroadcastSession call.
 */
async function updateCodespaceSession(
  _codeSpace: string,
  updatedData: ICodeSession,
): Promise<void> {
  await upsertSession(updatedData);
}

// ---------------------------------------------------------------------------
// Read Tools
// ---------------------------------------------------------------------------

export function executeReadCode(
  session: ICodeSession,
  codeSpace: string,
): ReadCodeResult {
  return {
    code: session.code,
    codeSpace,
  };
}

export function executeReadHtml(
  session: ICodeSession,
  codeSpace: string,
): ReadHtmlResult {
  return {
    html: session.html,
    codeSpace,
  };
}

export function executeReadSession(
  session: ICodeSession,
  codeSpace: string,
): ReadSessionResult {
  return {
    code: session.code,
    html: session.html,
    css: session.css,
    codeSpace,
  };
}

// ---------------------------------------------------------------------------
// Write Tools
// ---------------------------------------------------------------------------

export async function executeUpdateCode(
  session: ICodeSession,
  codeSpace: string,
  code: string,
  origin: string,
): Promise<UpdateCodeResult> {
  let transpiled = "";
  let transpilationFailed = false;

  try {
    transpiled = await transpileCode(code, origin);
  } catch (error) {
    logger.error("[MCP] Transpilation error", { error });
    transpilationFailed = true;
  }

  const updatedSession: ICodeSession = {
    ...session,
    code,
    transpiled,
    html: "",
    css: "",
    codeSpace,
  };

  await updateCodespaceSession(codeSpace, updatedSession);

  return {
    success: true,
    message: transpiled
      ? `Code updated and transpiled successfully (${code.length} chars).`
      : transpilationFailed
      ? `Code updated (${code.length} chars). Transpilation failed - will retry on next load.`
      : `Code updated (${code.length} chars). Transpilation pending.`,
    codeSpace,
    requiresTranspilation: !transpiled,
  };
}

export async function executeEditCode(
  session: ICodeSession,
  codeSpace: string,
  edits: LineEdit[],
  origin: string,
): Promise<EditCodeResult> {
  const originalCode = session.code || "";
  const { newCode, diff } = applyLineEdits(originalCode, edits);

  let transpiled = "";
  try {
    transpiled = await transpileCode(newCode, origin);
  } catch (error) {
    logger.error("[MCP] Transpilation error in edit_code", { error });
  }

  const updatedSession: ICodeSession = {
    ...session,
    code: newCode,
    transpiled,
    html: "",
    css: "",
    codeSpace,
  };

  await updateCodespaceSession(codeSpace, updatedSession);

  return {
    success: true,
    message: transpiled
      ? "Code edited and transpiled successfully."
      : "Code edited. Transpilation pending.",
    codeSpace,
    diff,
    linesChanged: edits.length,
    requiresTranspilation: !transpiled,
  };
}

export async function executeSearchAndReplace(
  session: ICodeSession,
  codeSpace: string,
  search: string,
  replace: string,
  isRegex: boolean,
  global: boolean,
  origin: string,
): Promise<SearchReplaceResult> {
  const originalCode = session.code || "";
  let newCode: string;
  let replacements = 0;

  try {
    if (isRegex) {
      const flags = global ? "g" : "";
      const regex = safeRegExp(search, flags);
      newCode = originalCode.replace(regex, replace);
      // Count actual replacements (not potential matches)
      if (global) {
        const matches = originalCode.match(safeRegExp(search, "g"));
        replacements = matches ? matches.length : 0;
      } else {
        replacements = newCode !== originalCode ? 1 : 0;
      }
    } else {
      if (global) {
        const regex = new RegExp(
          search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g",
        );
        const matches = originalCode.match(regex);
        replacements = matches ? matches.length : 0;
        newCode = originalCode.replace(regex, replace);
      } else {
        const index = originalCode.indexOf(search);
        if (index !== -1) {
          replacements = 1;
          newCode = originalCode.substring(0, index)
            + replace
            + originalCode.substring(index + search.length);
        } else {
          replacements = 0;
          newCode = originalCode;
        }
      }
    }
  } catch (error) {
    throw new Error(
      `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  let transpilationPending = false;
  if (replacements > 0) {
    let transpiled = "";
    try {
      transpiled = await transpileCode(newCode, origin);
    } catch (error) {
      logger.error(
        "[MCP] Transpilation error in search_and_replace",
        { error },
      );
    }
    transpilationPending = !transpiled;

    const updatedSession: ICodeSession = {
      ...session,
      code: newCode,
      transpiled,
      html: "",
      css: "",
      codeSpace,
    };

    await updateCodespaceSession(codeSpace, updatedSession);
  }

  return {
    success: true,
    message: replacements > 0
      ? transpilationPending
        ? `Made ${replacements} replacement(s). Code updated. Transpilation pending.`
        : `Made ${replacements} replacement(s). Code transpiled and updated.`
      : "No matches found",
    replacements,
    search,
    replace,
    isRegex,
    global,
    codeSpace,
    requiresTranspilation: transpilationPending,
  };
}

// ---------------------------------------------------------------------------
// Search Tools
// ---------------------------------------------------------------------------

export function executeFindLines(
  session: ICodeSession,
  codeSpace: string,
  pattern: string,
  isRegex: boolean,
): FindLinesResult {
  const code = session.code || "";
  const lines = code.split("\n");
  const matches: LineMatch[] = [];

  try {
    const searchPattern = isRegex ? safeRegExp(pattern, "gi") : pattern;

    lines.forEach((line: string, index: number) => {
      const lineNumber = index + 1;
      if (isRegex) {
        const regex = searchPattern as RegExp;
        const match = line.match(regex);
        if (match) {
          matches.push({
            lineNumber,
            content: line,
            matchText: match[0],
          });
        }
      } else {
        if (line.includes(searchPattern as string)) {
          matches.push({
            lineNumber,
            content: line,
            matchText: searchPattern as string,
          });
        }
      }
    });
  } catch (error) {
    throw new Error(
      `Invalid regex pattern: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    pattern,
    isRegex,
    matches,
    totalMatches: matches.length,
    codeSpace,
  };
}
