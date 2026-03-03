import type { PromptVariant, PromptContext } from "../types.js";

const reviewerV1: PromptVariant = {
  id: "reviewer-v1",
  role: "reviewer",
  render: (ctx: PromptContext) => `You are a strict code reviewer. Review each changed file and return a verdict.

For each file, output EXACTLY this format (one block per file, no other text):

FILE: <path>
VERDICT: APPROVE or REJECT
REASON: <one line explanation>

Reject if:
- Uses \`any\` type
- Has \`eslint-disable\` or \`@ts-ignore\`
- Introduces security vulnerabilities (injection, XSS, etc.)
- Has obvious logic bugs
- Has dead code or unused imports

Approve if the change is correct and follows TypeScript strict conventions.

DIFFS:
${ctx.diffs}`,
};

export default reviewerV1;
