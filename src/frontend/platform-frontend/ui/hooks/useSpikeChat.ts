import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_ENABLED, chatUrl, chatWsUrl } from "../../core-logic/api";

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  contentType: string;
  threadId: string | null;
  createdAt: number;
}

export interface AppUpdatedEvent {
  type: "app_updated";
  appSlug: string;
  version?: string;
  changedFiles?: string[];
  messageId: string;
}

type WsEvent =
  | { type: "message_new"; message: ChatMessage }
  | { type: "message_deleted"; id: string }
  | { type: "typing"; users: string[] }
  | AppUpdatedEvent;

interface UseSpikeChatOptions {
  channelId: string;
  enabled?: boolean;
  onAppUpdated?: (event: AppUpdatedEvent) => void;
  /** Maximum number of reconnect attempts before giving up. Defaults to 10. */
  maxReconnectAttempts?: number;
}

interface UseSpikeChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading: boolean;
  typingUsers: string[];
  sendMessage: (
    content: string,
    contentType?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
}

/** Minimum shape check before trusting a parsed WebSocket payload. */
function isWsEvent(value: unknown): value is WsEvent {
  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return typeof obj["type"] === "string";
}

/**
 * Subscribes to a spike.land chat channel over WebSocket and exposes
 * the message list alongside send/typing helpers.
 *
 * Reconnection uses exponential backoff (1 s → 30 s cap) and stops after
 * `maxReconnectAttempts` consecutive failures to prevent infinite loops.
 *
 * @param channelId - The channel to subscribe to.
 * @param enabled - Whether the hook should be active. Defaults to `true`.
 * @param onAppUpdated - Callback fired when an `app_updated` event arrives.
 * @param maxReconnectAttempts - Hard cap on reconnect attempts. Defaults to 10.
 */
export function useSpikeChat({
  channelId,
  enabled = true,
  onAppUpdated,
  maxReconnectAttempts = 10,
}: UseSpikeChatOptions): UseSpikeChatReturn {
  const [messageList, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttemptRef = useRef(0);
  const onAppUpdatedRef = useRef(onAppUpdated);
  onAppUpdatedRef.current = onAppUpdated;

  // Fetch message history
  useEffect(() => {
    if (!enabled || !channelId || !CHAT_ENABLED) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const url = chatUrl(`/api/v1/messages?channelId=${encodeURIComponent(channelId)}&limit=50`);
    fetch(url, {
      credentials: "include",
      headers: { "x-guest-access": "true" },
    })
      .then((r) => (r.ok ? (r.json() as Promise<ChatMessage[]>) : ([] as ChatMessage[])))
      .then((msgs) => {
        setMessages(msgs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [channelId, enabled]);

  // WebSocket connection with exponential backoff and reconnect limit
  useEffect(() => {
    if (!enabled || !channelId || !CHAT_ENABLED) {
      setIsConnected(false);
      return;
    }

    function connect() {
      // Stop reconnecting once the attempt cap is reached
      if (reconnectAttemptRef.current >= maxReconnectAttempts) {
        return;
      }

      const wsUrl = chatWsUrl(`/api/v1/channels/${encodeURIComponent(channelId)}/ws`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const parsed: unknown = JSON.parse(ev.data as string);
          if (!isWsEvent(parsed)) return;

          const event = parsed;
          switch (event.type) {
            case "message_new":
              setMessages((prev) => [...prev, event.message]);
              break;
            case "message_deleted":
              setMessages((prev) => prev.filter((m) => m.id !== event.id));
              break;
            case "typing":
              setTypingUsers(event.users);
              break;
            case "app_updated":
              onAppUpdatedRef.current?.(event);
              break;
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        reconnectAttemptRef.current++;

        if (reconnectAttemptRef.current >= maxReconnectAttempts) {
          // Attempt cap reached — do not schedule another reconnect
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
        const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), 30_000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
      wsRef.current = ws;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
      wsRef.current = null;
      // Reset attempt counter so the hook reconnects cleanly if re-enabled
      reconnectAttemptRef.current = 0;
    };
  }, [channelId, enabled, maxReconnectAttempts]);

  const sendMessage = useCallback(
    async (content: string, contentType = "text", metadata?: Record<string, unknown>) => {
      if (!CHAT_ENABLED) return;
      await fetch(chatUrl("/api/v1/messages"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-guest-access": "true",
        },
        body: JSON.stringify({ channelId, content, contentType, metadata }),
      });
    },
    [channelId],
  );

  const startTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing_start" }));
    }
  }, []);

  const stopTyping = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing_stop" }));
    }
  }, []);

  return {
    messages: messageList,
    isConnected,
    isLoading,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
  };
}
