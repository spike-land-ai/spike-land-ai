"use client";

import { useCallback, useRef, useState } from "react";
import { parseChatSSE, splitSSEBuffer } from "@/lib/bazdmeg/chat-stream";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseChatStreamReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (question: string) => Promise<void>;
  clearMessages: () => void;
}

/**
 * Thin hook for consuming a chat SSE stream.
 * Delegates parsing to pure functions in @/lib/bazdmeg/chat-stream.
 */
export function useChatStream(
  sessionId: string,
  endpoint = "/api/bazdmeg/chat",
  extraBody?: Record<string, string>,
): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question, sessionId, ...extraBody }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({
            error: "Request failed",
          }));
          throw new Error((errBody as { error?: string }).error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const { events, remainder } = splitSSEBuffer(buffer);
          buffer = remainder;

          for (const line of events) {
            const event = parseChatSSE(line);
            if (!event) continue;

            if (event.type === "text" && event.text) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + event.text,
                  };
                }
                return updated;
              });
            } else if (event.type === "error") {
              setError(event.error || "Stream error");
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, sessionId, endpoint, extraBody],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return { messages, isStreaming, error, sendMessage, clearMessages };
}
