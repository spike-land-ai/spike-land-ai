import type { ChatClientOptions } from "../../ai/client";

export function resolveTerminalChatClientOptions(
  options: Pick<ChatClientOptions, "model">,
): ChatClientOptions {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  const authToken = process.env["CLAUDE_CODE_OAUTH_TOKEN"];

  if (!apiKey && !authToken) {
    throw new Error(
      "Terminal agent requires ANTHROPIC_API_KEY or CLAUDE_CODE_OAUTH_TOKEN in the environment",
    );
  }

  // Prefer API key over OAuth token — OAuth may not be allowed for all orgs
  return {
    ...(apiKey ? { apiKey } : authToken ? { authToken } : {}),
    ...(options.model ? { model: options.model } : {}),
  };
}
