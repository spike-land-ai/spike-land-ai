import { useState, useCallback, useRef, useEffect } from "react";
import { apiUrl } from "../../core-logic/api";

export interface AetherMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{
    toolCallId: string;
    name: string;
    args: Record<string, unknown>;
    result?: string;
    status: "pending" | "done" | "error";
    transport: "mcp" | "browser";
  }>;
  timestamp: number;
}

export type PipelineStage = "classify" | "plan" | "execute" | "extract" | "idle";

interface UseAetherChatReturn {
  messages: AetherMessage[];
  sendMessage: (content: string) => Promise<void>;
  submitBrowserResult: (toolCallId: string, result: unknown) => Promise<void>;
  isStreaming: boolean;
  currentStage: PipelineStage;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
  noteCount: number;
  totalNoteCount: number;
  toolCatalogCount: number;
  model: string | null;
  lastLearnedLesson: string | null;
  /** The stable session ID (persists across page reloads for authenticated users). */
  sessionId: string | null;
  /** Whether the DO session is available (history loaded from server). */
  sessionReady: boolean;
}

const STORAGE_KEY = "aether-chat-messages";
const SESSION_ID_KEY = "aether-session-id";
const LAST_EVENT_ID_KEY = "aether-last-event-id";

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
 * @returns `noteCount` — active memory notes currently injected into the prompt.
 * @returns `totalNoteCount` — total learned notes available for this user.
 * @returns `toolCatalogCount` — size of the MCP catalog visible to spike-chat.
 * @returns `model` — active execution model name reported by the server.
 * @returns `lastLearnedLesson` — latest extracted reusable lesson, if any.
 */
export function useAetherChat(): UseAetherChatReturn {
  const [messages, setMessages] = useState<AetherMessage[]>(loadStoredMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [totalNoteCount, setTotalNoteCount] = useState(0);
  const [toolCatalogCount, setToolCatalogCount] = useState(0);
  const [model, setModel] = useState<string | null>(null);
  const [lastLearnedLesson, setLastLearnedLesson] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(() => {
    try {
      return localStorage.getItem(SESSION_ID_KEY);
    } catch {
      return null;
    }
  });
  const lastEventIdRef = useRef<number>(() => {
    try {
      const stored = localStorage.getItem(LAST_EVENT_ID_KEY);
      return stored ? Number(stored) : 0;
    } catch {
      return 0;
    }
  });

  // Persist messages to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  // Load session history from DO on mount (server-side truth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl("/spike-chat/history"), {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data: unknown = await res.json();
        if (cancelled || !isObject(data)) return;

        const serverMessages = data["messages"];
        const serverSessionId = typeof data["sessionId"] === "string" ? data["sessionId"] : null;

        if (serverSessionId) {
          sessionIdRef.current = serverSessionId;
          localStorage.setItem(SESSION_ID_KEY, serverSessionId);
        }

        if (Array.isArray(serverMessages) && serverMessages.length > 0) {
          // Merge: prefer server history if it has more messages than localStorage
          setMessages((local) => {
            if (serverMessages.length >= local.length) {
              return serverMessages
                .filter(
                  (m: unknown): m is { role: string; content: string; timestamp: number } =>
                    isObject(m) &&
                    typeof m["role"] === "string" &&
                    typeof m["content"] === "string",
                )
                .map((m) => ({
                  id: makeId(),
                  role: m.role as "user" | "assistant",
                  content: m.content,
                  timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
                }));
            }
            return local;
          });
        }
        setSessionReady(true);
      } catch {
        // DO unavailable — use localStorage (already loaded)
        setSessionReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
            // Track SSE event IDs for stream resumption
            if (line.startsWith("id: ")) {
              const eventId = Number(line.slice(4).trim());
              if (!Number.isNaN(eventId)) {
                lastEventIdRef.current = eventId;
                try {
                  localStorage.setItem(LAST_EVENT_ID_KEY, String(eventId));
                } catch {
                  // localStorage unavailable
                }
              }
              continue;
            }
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed: unknown = JSON.parse(data);
              if (!isObject(parsed)) continue;

              const eventType = typeof parsed["type"] === "string" ? parsed["type"] : "";

              if (eventType === "context_sync") {
                const activeNoteCount =
                  typeof parsed["activeNoteCount"] === "number" ? parsed["activeNoteCount"] : 0;
                const knownTotalNoteCount =
                  typeof parsed["totalNoteCount"] === "number" ? parsed["totalNoteCount"] : 0;
                const knownToolCatalogCount =
                  typeof parsed["toolCatalogCount"] === "number" ? parsed["toolCatalogCount"] : 0;
                setNoteCount(activeNoteCount);
                setTotalNoteCount(knownTotalNoteCount);
                setToolCatalogCount(knownToolCatalogCount);
                setModel(typeof parsed["model"] === "string" ? parsed["model"] : null);
                const syncedSessionId =
                  typeof parsed["sessionId"] === "string" ? parsed["sessionId"] : null;
                sessionIdRef.current = syncedSessionId;
                if (syncedSessionId) {
                  try {
                    localStorage.setItem(SESSION_ID_KEY, syncedSessionId);
                  } catch {
                    // localStorage unavailable
                  }
                }
              } else if (eventType === "memory_update") {
                if (typeof parsed["activeNoteCount"] === "number") {
                  setNoteCount(parsed["activeNoteCount"]);
                }
                if (typeof parsed["totalNoteCount"] === "number") {
                  setTotalNoteCount(parsed["totalNoteCount"]);
                }
                if (typeof parsed["lesson"] === "string") {
                  setLastLearnedLesson(parsed["lesson"]);
                }
              } else if (eventType === "stage_update") {
                const stage = typeof parsed["stage"] === "string" ? parsed["stage"] : undefined;
                setCurrentStage(toPipelineStage(stage));
              } else if (eventType === "text_delta" && typeof parsed["text"] === "string") {
                const deltaText = parsed["text"];
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id ? { ...m, content: m.content + deltaText } : m,
                  ),
                );
              } else if (
                eventType === "tool_call_start" &&
                typeof parsed["name"] === "string" &&
                typeof parsed["toolCallId"] === "string"
              ) {
                const toolName = parsed["name"];
                const toolCallId = parsed["toolCallId"];
                const toolArgs = isObject(parsed["args"])
                  ? (parsed["args"] as Record<string, unknown>)
                  : {};
                const parsedTransport = parsed["transport"];
                const transport: "mcp" | "browser" =
                  parsedTransport === "browser" || parsedTransport === "mcp"
                    ? parsedTransport
                    : "mcp";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls ?? []),
                            {
                              toolCallId,
                              name: toolName,
                              args: toolArgs,
                              status: "pending" as const,
                              transport,
                            },
                          ],
                        }
                      : m,
                  ),
                );
              } else if (
                eventType === "tool_call_end" &&
                typeof parsed["toolCallId"] === "string"
              ) {
                const endToolCallId = parsed["toolCallId"];
                const endResult =
                  typeof parsed["result"] === "string" ? parsed["result"] : undefined;
                const parsedStatus = parsed["status"];
                const endStatus: "pending" | "done" | "error" =
                  parsedStatus === "error" || parsedStatus === "pending" ? parsedStatus : "done";
                const parsedTransport = parsed["transport"];
                const transport: "mcp" | "browser" =
                  parsedTransport === "browser" || parsedTransport === "mcp"
                    ? parsedTransport
                    : "mcp";
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsg.id
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.toolCallId === endToolCallId
                              ? {
                                  ...tc,
                                  ...(endResult !== undefined ? { result: endResult } : {}),
                                  status: endStatus,
                                  transport,
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
  const submitBrowserResult = useCallback(async (toolCallId: string, result: unknown) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      return;
    }

    setMessages((prev) =>
      prev.map((message) =>
        message.role === "assistant"
          ? {
              ...message,
              toolCalls: (message.toolCalls ?? []).map((toolCall) =>
                toolCall.toolCallId === toolCallId && toolCall.transport === "browser"
                  ? {
                      ...toolCall,
                      result: typeof result === "string" ? result : JSON.stringify(result, null, 2),
                    }
                  : toolCall,
              ),
            }
          : message,
      ),
    );

    try {
      const res = await fetch(apiUrl("/spike-chat/browser-results"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sessionId,
          toolCallId,
          result,
        }),
      });

      if (!res.ok) {
        throw new Error((await res.text()) || `HTTP ${res.status}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit browser result";
      setError(message);
      setMessages((prev) =>
        prev.map((item) =>
          item.role === "assistant"
            ? {
                ...item,
                toolCalls: (item.toolCalls ?? []).map((toolCall) =>
                  toolCall.toolCallId === toolCallId
                    ? {
                        ...toolCall,
                        status: "error",
                        result: message,
                      }
                    : toolCall,
                ),
              }
            : item,
        ),
      );
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setLastLearnedLesson(null);
    sessionIdRef.current = null;
    lastEventIdRef.current = 0;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(LAST_EVENT_ID_KEY);
  }, []);

  return {
    messages,
    sendMessage,
    submitBrowserResult,
    isStreaming,
    currentStage,
    error,
    clearError,
    clearMessages,
    noteCount,
    totalNoteCount,
    toolCatalogCount,
    model,
    lastLearnedLesson,
    sessionId: sessionIdRef.current,
    sessionReady,
  };
}
