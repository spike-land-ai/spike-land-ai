import type { PromptVariant, PromptContext } from "../types.js";

const fixerV1: PromptVariant = {
  id: "fixer-v1",
  role: "fixer",
  render: (ctx: PromptContext) => `You are a TypeScript code fixer. Fix ALL the errors below. Do not add comments explaining what you changed. Do not refactor unrelated code. Only fix the errors.

Rules:
- Never use \`any\` type — use \`unknown\` or proper types
- Never add \`eslint-disable\` or \`@ts-ignore\` comments
- Keep changes minimal and focused

ERRORS:
${ctx.errors}`,
};

export default fixerV1;
