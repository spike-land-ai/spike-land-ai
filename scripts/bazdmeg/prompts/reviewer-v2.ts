import type { PromptVariant, PromptContext } from "../types.js";

const reviewerV2: PromptVariant = {
  id: "reviewer-v2",
  role: "reviewer",
  render: (ctx: PromptContext) => `Review each file diff below. You must output a structured verdict for every file.

Output format (strictly one block per file, nothing else):

FILE: <filepath>
VERDICT: APPROVE
REASON: <why it's acceptable>

or

FILE: <filepath>
VERDICT: REJECT
REASON: <specific issue that must be fixed>

Review criteria (reject if ANY apply):
1. \`any\` type usage (use \`unknown\` or proper types instead)
2. \`eslint-disable\`, \`@ts-ignore\`, \`@ts-nocheck\` comments
3. Security issues: command injection, XSS, SQL injection, path traversal
4. Missing error handling on async operations that can fail
5. Unused imports or dead code introduced by the change
6. Console.log left in production code (console.error is fine)

Accept if the change is correct, typed, and follows project conventions.

${ctx.diffs}`,
};

export default reviewerV2;
