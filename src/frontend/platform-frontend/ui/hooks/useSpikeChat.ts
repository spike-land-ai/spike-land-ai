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
}

interface UseSpikeChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  isLoading: boolean;
  typingUsers: string[];
  sendMessage: (content: string, contentType?: string, metadata?: Record<string, unknown>) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
}

export function useSpikeChat({
  channelId,
  enabled = true,
  onAppUpdated,
}: UseSpikeChatOptions): UseSpikeChatReturn {
  const [messageList, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
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
      .then((r) => (r.ok ? r.json() : []))
      .then((msgs: ChatMessage[]) => {
        setMessages(msgs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [channelId, enabled]);

  // WebSocket connection with exponential backoff
  useEffect(() => {
    if (!enabled || !channelId || !CHAT_ENABLED) {
      setIsConnected(false);
      return;
    }

    function connect() {
      const wsUrl = chatWsUrl(`/api/v1/channels/${encodeURIComponent(channelId)}/ws`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (ev) => {
        try {
          const event = JSON.parse(ev.data) as WsEvent;
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
        // Exponential backoff: 1s, 2s, 4s, 8s, ... capped at 30s
        const delay = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30_000);
        reconnectAttemptRef.current++;
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
    };
  }, [channelId, enabled]);

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

  return { messages: messageList, isConnected, isLoading, typingUsers, sendMessage, startTyping, stopTyping };
}
