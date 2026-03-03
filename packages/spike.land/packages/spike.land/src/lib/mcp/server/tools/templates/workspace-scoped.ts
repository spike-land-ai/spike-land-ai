/**
 * Workspace-Scoped Tool Template
 *
 * Reusable pattern for tools that require workspace membership validation.
 * Handles workspace resolution + tier checking before delegating to the handler.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { SubscriptionTier } from "@prisma/client";
import { resolveWorkspace, safeToolCall, textResult } from "../tool-helpers";

export interface WorkspaceScopedConfig {
  toolName: string;
  requiredTier?: SubscriptionTier;
}

/**
 * Wrap a tool handler with workspace resolution and optional tier checking.
 * The resolved workspace is passed to the inner handler.
 *
 * Usage:
 * ```ts
 * handler: workspaceScopedHandler(
 *   { toolName: "my_tool" },
 *   userId,
 *   async (input, workspace) => {
 *     // workspace is already resolved and validated
 *     return textResult(`Workspace: ${workspace.name}`);
 *   },
 * )
 * ```
 */
export function workspaceScopedHandler<
  T extends { workspace_slug: string; },
>(
  config: WorkspaceScopedConfig,
  userId: string,
  inner: (
    input: T,
    workspace: {
      id: string;
      slug: string;
      name: string;
      subscriptionTier: SubscriptionTier;
    },
  ) => Promise<CallToolResult>,
): (input: T) => Promise<CallToolResult> {
  return (input: T) =>
    safeToolCall(config.toolName, async () => {
      const workspace = await resolveWorkspace(userId, input.workspace_slug);

      if (
        config.requiredTier
        && workspace.subscriptionTier !== config.requiredTier
      ) {
        return textResult(
          `**Error: TIER_REQUIRED**\n`
            + `This tool requires the **${config.requiredTier}** tier.\n`
            + `Current workspace tier: **${workspace.subscriptionTier}**`,
        );
      }

      return inner(input, workspace);
    });
}
