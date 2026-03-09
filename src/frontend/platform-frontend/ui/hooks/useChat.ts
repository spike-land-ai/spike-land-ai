import { useState, useCallback, useRef, useEffect } from "react";
import { apiUrl } from "../../core-logic/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "pending" | "done" | "error";
  }>;
  browserCommands?: Array<{
    tool: string;
    args: Record<string, unknown>;
    requestId: string;
    result?: unknown;
  }>;
  timestamp: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
  submitBrowserResult: (requestId: string, result: unknown) => void;
}

const STORAGE_KEY = "spike-chat-messages";

let nextId = 0;
function makeId() {
  return `msg-${Date.now()}-${++nextId}`;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as ChatMessage[];
    } catch {
      return [];
    }
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingBrowserRef = useRef<Map<string, (result: unknown) => void>>(new Map());

  // Debounce localStorage persistence to avoid excessive I/O during streaming
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const submitBrowserResult = useCallback((requestId: string, result: unknown) => {
    const resolve = pendingBrowserRef.current.get(requestId);
    if (resolve) {
      resolve(result);
      pendingBrowserRef.current.delete(requestId);
    }
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setError(null);

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content: "",
        toolCalls: [],
        browserCommands: [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        abortRef.current = new AbortController();

        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch(apiUrl("/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ message: content.trim(), history }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(errBody || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const event = JSON.parse(data) as {
                type: string;
                text?: string;
                name?: string;
                args?: Record<string, unknown>;
                result?: string;
                requestId?: string;
                tool?: string;
                error?: string;
              };

              if (event.type === "text_delta" && event.text) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: m.content + event.text } : m,
                  ),
                );
              } else if (event.type === "tool_call_start" && event.name) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls || []),
                            {
                              name: event.name!,
                              args: event.args || {},
                              status: "pending" as const,
                            },
                          ],
                        }
                      : m,
                  ),
                );
              } else if (event.type === "tool_call_end" && event.name) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls || []).map((tc) =>
                            tc.name === event.name && tc.status === "pending"
                              ? {
                                  ...tc,
                                  ...(event.result !== undefined ? { result: event.result } : {}),
                                  status: "done" as const,
                                }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
              } else if (event.type === "browser_command" && event.tool && event.requestId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          browserCommands: [
                            ...(m.browserCommands || []),
                            {
                              tool: event.tool!,
                              args: event.args || {},
                              requestId: event.requestId!,
                            },
                          ],
                        }
                      : m,
                  ),
                );
              } else if (event.type === "error") {
                setError(event.error || "Unknown error");
              }
            } catch {
              // skip malformed SSE
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const msg = err instanceof Error ? err.message : "Failed to send message";
        setError(msg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id && !m.content
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m,
          ),
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [isStreaming, messages],
  );

  const clearError = useCallback(() => setError(null), []);
  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    sendMessage,
    isStreaming,
    error,
    clearError,
    clearMessages,
    submitBrowserResult,
  };
}
