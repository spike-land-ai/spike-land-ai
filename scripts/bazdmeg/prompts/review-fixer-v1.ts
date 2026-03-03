import type { PromptVariant, PromptContext } from "../types.js";

const reviewFixerV1: PromptVariant = {
  id: "review-fixer-v1",
  role: "review-fixer",
  render: (ctx: PromptContext) => `A code reviewer rejected the following files. Fix the issues described in the feedback. Only modify the rejected files.

Rules:
- Never use \`any\` type
- Never add \`eslint-disable\` or \`@ts-ignore\`
- Address each rejection reason specifically

REJECTED FILES AND FEEDBACK:
${ctx.feedback}`,
};

export default reviewFixerV1;
