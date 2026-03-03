import { execSync } from "node:child_process";
import type { PromptContext, PromptVariant } from "./types.js";

export function spawnClaude(
  prompt: PromptVariant,
  context: PromptContext,
): string {
  const rendered = prompt.render(context);
  // Strip CLAUDECODE env var to allow nested Claude sessions
  const env = { ...process.env };
  delete env.CLAUDECODE;
  const output = execSync(
    `claude -p --dangerously-skip-permissions --model sonnet`,
    {
      input: rendered,
      encoding: "utf-8",
      cwd: process.cwd(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024,
      timeout: 5 * 60 * 1000, // 5 min timeout
    },
  );
  return output.trim();
}
