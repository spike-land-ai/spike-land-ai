import type { PromptVariant, PromptContext } from "../types.js";

const fixerV2: PromptVariant = {
  id: "fixer-v2",
  role: "fixer",
  render: (ctx: PromptContext) => `Fix the following build/lint/test errors. Be surgical — change only what's needed to make the checks pass. Do not touch unrelated code.

Constraints:
- No \`any\` types. Use \`unknown\`, generics, or proper interfaces.
- No \`eslint-disable\`, \`@ts-ignore\`, or \`@ts-nocheck\`.
- No unnecessary refactoring.
- If a test fails, fix the code under test — not the test assertion — unless the test expectation is clearly wrong.

Error output:
\`\`\`
${ctx.errors}
\`\`\``,
};

export default fixerV2;
