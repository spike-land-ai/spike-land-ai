import { useState, useCallback, useRef, useEffect } from "react";
import { apiUrl } from "../../core-logic/api";

export interface AetherMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "pending" | "done" | "error";
  }>;
  timestamp: number;
}

export type PipelineStage = "classify" | "plan" | "execute" | "extract" | "idle";

interface UseAetherChatReturn {
  messages: AetherMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  currentStage: PipelineStage;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
  noteCount: number;
}

const STORAGE_KEY = "aether-chat-messages";

const VALID_STAGES: ReadonlySet<string> = new Set<PipelineStage>([
  "classify",
  "plan",
  "execute",
  "extract",
  "idle",
]);

/**
 * Narrows an unknown string value to `PipelineStage`. Returns `"idle"` as the
 * safe fallback for any unrecognised stage name from the server.
 */
function toPipelineStage(value: string | undefined): PipelineStage {
  return value !== undefined && VALID_STAGES.has(value) ? (value as PipelineStage) : "idle";
}

/**
 * Returns `true` when `value` is a non-null object (basic guard used before
 * accessing typed properties on parsed JSON payloads).
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

/**
 * Parses the persisted message array from localStorage. Returns an empty array
 * when the stored JSON is absent, malformed, or not an array of objects.
 */
function loadStoredMessages(): AetherMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Accept items that have at minimum an `id` and `role` string field
    return parsed.filter(
      (item): item is AetherMessage =>
        isObject(item) &&
        typeof item["id"] === "string" &&
        (item["role"] === "user" || item["role"] === "assistant"),
    );
  } catch {
    return [];
  }
}

let nextId = 0;
function makeId() {
  return `aether-${Date.now()}-${++nextId}`;
}

/**
 * Manages a streaming AI chat session with the Aether pipeline endpoint.
 *
 * - Persists the message history to localStorage (debounced to 1 s).
 * - Streams SSE events from `/spike-chat` and applies incremental updates.
 * - Exposes pipeline stage transitions for progress UI.
 * - Supports abort via in-flight request cancellation.
 *
 * @returns `messages` — current conversation history.
 * @returns `sendMessage` — send a user message and stream the assistant reply.
 * @returns `isStreaming` — `true` while a response is in flight.
 * @returns `currentStage` — the active pipeline stage reported by the server.
 * @returns `error` — last error string, or `null`.
 * @returns `clearError` — resets the error state.
 * @returns `clearMessages` — clears history and localStorage.
 * @returns `noteCount` — reserved for future note-tracking feature.
 */
export function useAetherChat(): UseAetherChatReturn {
  const [messages, setMessages] = useState<AetherMessage[]>(loadStoredMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [noteCount, _setNoteCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  // Persist messages to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: AetherMessage = {
        id: makeId(),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setCurrentStage("classify");
      setError(null);

      const assistantMsg: AetherMessage = {
        id: makeId(),
        role: "assistant",
        content: "",
        toolCalls: [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        abortRef.current = new AbortController();

        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch(apiUrl("/spike-chat"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed: unknown = JSON.parse(data);
              if (!isObject(parsed)) continue;

              const eventType = typeof parsed["type"] === "string" ? parsed["type"] : "";

              if (eventType === "stage_update") {
                const stage = typeof parsed["stage"] === "string" ? parsed["stage"] : undefined;
                setCurrentStage(toPipelineStage(stage));
              } else if (eventType === "text_delta" && typeof parsed["text"] === "string") {
                const deltaText = parsed["text"];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: m.content + deltaText } : m,
                  ),
                );
              } else if (eventType === "tool_call_start" && typeof parsed["name"] === "string") {
                const toolName = parsed["name"];
                const toolArgs = isObject(parsed["args"])
                  ? (parsed["args"] as Record<string, unknown>)
                  : {};
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls ?? []),
                            {
                              name: toolName,
                              args: toolArgs,
                              status: "pending" as const,
                            },
                          ],
                        }
                      : m,
                  ),
                );
              } else if (eventType === "tool_call_end" && typeof parsed["name"] === "string") {
                const endName = parsed["name"];
                const endResult =
                  typeof parsed["result"] === "string" ? parsed["result"] : undefined;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === endName && tc.status === "pending"
                              ? {
                                  ...tc,
                                  ...(endResult !== undefined ? { result: endResult } : {}),
                                  status: "done" as const,
                                }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
              } else if (eventType === "error") {
                const errMsg =
                  typeof parsed["error"] === "string" ? parsed["error"] : "Unknown error";
                setError(errMsg);
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
        setCurrentStage("idle");
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
    currentStage,
    error,
    clearError,
    clearMessages,
    noteCount,
  };
}
