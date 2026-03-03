import type { PromptVariant, PromptContext } from "../types.js";

const reviewFixerV2: PromptVariant = {
  id: "review-fixer-v2",
  role: "review-fixer",
  render: (ctx: PromptContext) => `The code reviewer rejected these files. Fix ONLY the specific issues mentioned. Do not refactor or change anything beyond what the reviewer flagged.

For each rejected file:
1. Read the rejection reason carefully
2. Make the minimum change to address it
3. Ensure the fix follows TypeScript strict mode conventions

Constraints:
- No \`any\` types — use \`unknown\` or specific types
- No suppression comments (\`eslint-disable\`, \`@ts-ignore\`, \`@ts-nocheck\`)
- Do not touch files that weren't rejected

Reviewer feedback:
\`\`\`
${ctx.feedback}
\`\`\``,
};

export default reviewFixerV2;
