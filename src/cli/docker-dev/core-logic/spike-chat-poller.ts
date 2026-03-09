/**
 * Spike-Chat REST API Poller
 *
 * Replaces Redis polling with spike-chat REST API polling.
 * The agent watches app channels for new messages, sends them to Claude,
 * and posts responses back to the channel.
 */

interface SpikeChatConfig {
  chatUrl: string;
  apiKey: string;
  pollInterval: number;
}

interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  contentType: string;
  createdAt: number;
}

/**
 * Fetches messages from a spike-chat channel newer than `since` (a ULID cursor).
 * Returns messages in chronological order.
 */
export async function fetchNewMessages(
  config: SpikeChatConfig,
  channelId: string,
  since?: string,
): Promise<ChatMessage[]> {
  const params = new URLSearchParams({ channelId, limit: "50" });
  if (since) params.set("since", since);

  const res = await fetch(`${config.chatUrl}/api/v1/messages?${params}`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch messages: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<ChatMessage[]>;
}

/**
 * Posts a message to a spike-chat channel as the agent.
 */
export async function postMessage(
  config: SpikeChatConfig,
  channelId: string,
  content: string,
  contentType = "text",
  metadata?: Record<string, unknown>,
): Promise<ChatMessage> {
  const res = await fetch(`${config.chatUrl}/api/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "x-agent-id": "agent-vibe-dev",
    },
    body: JSON.stringify({ channelId, content, contentType, metadata }),
  });

  if (!res.ok) {
    throw new Error(`Failed to post message: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<ChatMessage>;
}

/**
 * Posts an app_updated event to a channel, notifying live clients of a code change.
 */
export async function postAppUpdated(
  config: SpikeChatConfig,
  appSlug: string,
  summary: string,
  metadata?: { version?: string; changedFiles?: string[] },
): Promise<ChatMessage> {
  const channelId = `app-${appSlug}`;
  return postMessage(config, channelId, summary, "app_updated", metadata);
}

/**
 * Lists available app-* channels from spike-chat.
 */
export async function listAppChannels(
  config: SpikeChatConfig,
  workspaceId = "default",
): Promise<Array<{ id: string; slug: string; name: string }>> {
  const res = await fetch(
    `${config.chatUrl}/api/v1/channels?workspaceId=${encodeURIComponent(workspaceId)}`,
    {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) return [];
  const channels = (await res.json()) as Array<{ id: string; slug: string; name: string }>;
  return channels.filter((ch) => ch.slug.startsWith("app-"));
}

/**
 * Polls multiple app channels for new messages.
 * Maintains a cursor (last seen message ID) per channel.
 *
 * Returns an array of { channelId, messages } for channels with new messages.
 */
export async function pollChannels(
  config: SpikeChatConfig,
  channelIds: string[],
  cursors: Map<string, string>,
): Promise<Array<{ channelId: string; messages: ChatMessage[] }>> {
  const results: Array<{ channelId: string; messages: ChatMessage[] }> = [];

  await Promise.all(
    channelIds.map(async (channelId) => {
      try {
        const since = cursors.get(channelId);
        const msgs = await fetchNewMessages(config, channelId, since);

        // Filter out bot messages to avoid self-reply loops
        const userMessages = msgs.filter(
          (m) => !m.userId.startsWith("agent-") && m.userId !== "system",
        );

        if (userMessages.length > 0) {
          results.push({ channelId, messages: userMessages });
        }

        // Update cursor to the last message ID (including bot messages)
        if (msgs.length > 0) {
          cursors.set(channelId, msgs[msgs.length - 1]?.id);
        }
      } catch (err) {
        console.error(`[spike-chat-poller] Error polling ${channelId}:`, err);
      }
    }),
  );

  return results;
}

/**
 * Creates a spike-chat config from environment variables or CLI flags.
 */
export function createSpikeChatConfig(overrides?: Partial<SpikeChatConfig>): SpikeChatConfig {
  const chatUrl = overrides?.chatUrl
    || process.env.SPIKE_CHAT_URL
    || "https://chat.spike.land";

  const apiKey = overrides?.apiKey
    || process.env.AGENT_API_KEY
    || "";

  const pollInterval = overrides?.pollInterval
    || parseInt(process.env.SPIKE_CHAT_POLL_INTERVAL || "5000", 10);

  if (!apiKey) {
    throw new Error(
      "AGENT_API_KEY is required for spike-chat polling. Set it via --api-key flag or AGENT_API_KEY env var.",
    );
  }

  return { chatUrl, apiKey, pollInterval };
}

/**
 * Runs the polling loop.
 * Calls `onMessages` for each batch of new messages per channel.
 * Returns a stop function.
 */
export function startPollingLoop(
  config: SpikeChatConfig,
  channelIds: string[],
  onMessages: (channelId: string, messages: ChatMessage[]) => Promise<void>,
): { stop: () => void } {
  const cursors = new Map<string, string>();
  let running = true;
  let timeoutId: ReturnType<typeof setTimeout>;

  async function tick() {
    if (!running) return;

    try {
      const batches = await pollChannels(config, channelIds, cursors);
      for (const batch of batches) {
        await onMessages(batch.channelId, batch.messages);
      }
    } catch (err) {
      console.error("[spike-chat-poller] Poll error:", err);
    }

    if (running) {
      timeoutId = setTimeout(tick, config.pollInterval);
    }
  }

  tick();

  return {
    stop() {
      running = false;
      clearTimeout(timeoutId);
    },
  };
}
