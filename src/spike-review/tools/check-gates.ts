/**
 * check_bazdmeg_gates Tool
 *
 * Run BAZDMEG quality gates against a diff without posting to GitHub.
 * Useful for pre-push validation.
 */

import { formatGateResults, getBuiltinRules, runGates } from "../rules/engine.js";
import type { RuleContext } from "../rules/engine.js";
import { parseClaudeMd, rulesToPromptLines } from "../rules/claude-md-parser.js";
import type { z } from "zod";
import type { CheckGatesSchema } from "../types.js";

export function checkBazdmegGates(params: z.infer<typeof CheckGatesSchema>): string {
  // Parse CLAUDE.md rules if provided
  const claudeMdRules: string[] = [];
  if (params.claudeMdContent) {
    const parsed = parseClaudeMd(params.claudeMdContent);
    claudeMdRules.push(...rulesToPromptLines(parsed));
  }

  // Build rule context from diff
  const diffLines = params.diff.split("\n");
  const addedFiles = new Set<string>();
  for (const line of diffLines) {
    if (line.startsWith("+++ b/")) {
      addedFiles.add(line.replace("+++ b/", ""));
    }
  }

  const additions = diffLines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
  const deletions = diffLines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

  const ruleContext: RuleContext = {
    diff: params.diff,
    files: [...addedFiles],
    additions,
    deletions,
    prTitle: "(local check)",
    prBody: null,
    claudeMdRules,
  };

  const rules = getBuiltinRules();
  const gateResults = runGates(rules, ruleContext);
  return formatGateResults(gateResults);
}
