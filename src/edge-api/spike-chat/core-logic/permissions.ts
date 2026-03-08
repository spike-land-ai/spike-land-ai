import type { Env } from "./env";

export async function checkWorkspaceMembership(
  env: Env,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  // Visitors are handled separately at the channel level depending on guestAccess settings
  if (userId.startsWith("visitor-")) {
    return true;
  }

  try {
    const res = await env.MCP_SERVICE.fetch(
      new Request(`https://mcp.spike.land/internal/workspaces/${workspaceId}/members/${userId}`),
    );

    if (res.status === 404) {
      return false; // Not a member
    }

    return res.ok;
  } catch (error) {
    console.error("Error checking workspace membership:", error);
    // Fail closed
    return false;
  }
}

/**
 * Check if a user has access to a specific channel.
 * TODO: Implement actual channel access checks against D1:
 * - For public channels: check workspace membership
 * - For private channels: check channel_members table
 * - For DMs: check if user is a participant
 * Currently returns true (open access) — acceptable for MVP.
 */
export async function checkChannelAccess(
  _env: Env,
  _userId: string,
  _channelId: string,
): Promise<boolean> {
  return true;
}
