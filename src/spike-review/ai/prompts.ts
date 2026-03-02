/**
 * Review Prompt Templates
 *
 * LLM prompt construction for code review.
 */

import type { PRDetails } from "../types.js";

export const DEFAULT_REVIEW_PROMPT = `You are Spike Review, an experienced code reviewer that follows the BAZDMEG method.

## Review Guidelines

### 1. Code Quality
- Clean, readable code following project conventions
- No TypeScript \`any\` types, \`eslint-disable\`, or \`@ts-ignore\`
- Proper error handling and edge cases

### 2. Security
- No hardcoded secrets or credentials
- Input validation at system boundaries
- No injection vulnerabilities (SQL, XSS, command injection)

### 3. Performance
- No unnecessary re-renders, N+1 queries, or memory leaks
- Efficient algorithms and data structures

### 4. Testing
- Changes should include tests or be covered by existing tests
- Tests should verify behavior, not implementation details

### 5. Architecture
- Changes fit the existing codebase patterns
- No unnecessary abstractions or over-engineering
- SOLID principles where applicable

## Output Format

For each issue found, provide:
- **File path** and **line number**
- **Severity**: critical (must fix), high (should fix), medium (consider), low (nit)
- **Confidence**: 0-100 score of how confident you are this is a real issue
- **Description**: Clear explanation of the issue and how to fix it

End with a verdict: APPROVE, REQUEST_CHANGES, or COMMENT.
Only use REQUEST_CHANGES for critical or high-severity issues with confidence >= 80.`;

export function buildReviewPrompt(
  prDetails: PRDetails,
  diff: string,
  customPrompt?: string,
  additionalRules?: string[],
): string {
  const prompt = customPrompt ?? DEFAULT_REVIEW_PROMPT;

  let fullPrompt = prompt;

  if (additionalRules && additionalRules.length > 0) {
    fullPrompt += "\n\n## Additional Project Rules\n";
    for (const rule of additionalRules) {
      fullPrompt += `- ${rule}\n`;
    }
  }

  fullPrompt += `\n\n## Pull Request Context\n`;
  fullPrompt += `- **Title**: ${prDetails.title}\n`;
  fullPrompt += `- **Author**: ${prDetails.author ?? "unknown"}\n`;
  fullPrompt += `- **Description**: ${prDetails.body ?? "(no description)"}\n`;
  fullPrompt += `- **Changes**: +${prDetails.additions} / -${prDetails.deletions} across ${prDetails.changedFiles} files\n`;
  fullPrompt += `- **Branch**: ${prDetails.headRef} → ${prDetails.baseRef}\n`;

  fullPrompt += `\n## Diff\n\n\`\`\`diff\n${diff}\n\`\`\``;

  return fullPrompt;
}
