import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../../core-logic/api";

export interface ChatUsageSnapshot {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatUsage extends ChatUsageSnapshot {
  contextWindow: number;
}

export interface ChatThreadSummary {
  id: string;
  title: string;
  usage: ChatUsageSnapshot | null;
  createdAt: number;
  updatedAt: number;
}

interface StoredTextBlock {
  type: "text";
  text: string;
}

interface StoredToolCallBlock {
  type: "tool_call";
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "done" | "error";
  transport: "browser" | "mcp";
}

type StoredAssistantBlock = StoredTextBlock | StoredToolCallBlock;

interface ThreadRound {
  id: string;
  inputRole: string;
  inputContent: string | null;
  assistantBlocks: StoredAssistantBlock[];
  assistantText: string;
  usage: ChatUsageSnapshot | null;
  createdAt: number;
  updatedAt: number;
}

export interface UserConversationItem {
  id: string;
  kind: "user";
  content: string;
  timestamp: number;
}

export interface AssistantTextConversationItem {
  id: string;
  kind: "assistant_text";
  content: string;
  timestamp: number;
}

export interface ToolCallConversationItem {
  id: string;
  kind: "tool_call";
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: "pending" | "done" | "error";
  transport: "browser" | "mcp";
  timestamp: number;
}

export type ConversationItem =
  | UserConversationItem
  | AssistantTextConversationItem
  | ToolCallConversationItem;

interface UseChatOptions {
  enabled?: boolean;
  persona?: string;
}

interface UseChatReturn {
  threads: ChatThreadSummary[];
  currentThreadId: string | null;
  items: ConversationItem[];
  usage: ChatUsage | null;
  isLoadingHistory: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  selectThread: (threadId: string) => Promise<void>;
  newThread: () => void;
  clearError: () => void;
  submitBrowserResult: (toolCallId: string, result: unknown) => Promise<void>;
}

interface ThreadDetailResponse {
  thread: ChatThreadSummary;
  rounds: ThreadRound[];
}

interface ThreadsResponse {
  threads: ChatThreadSummary[];
}

interface SettingsResponse {
  context_window?: number;
}

let nextId = 0;
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${++nextId}`;
}

function formatToolResult(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * Transforms a raw array of thread rounds (as stored on the server) into a
 * flat, ordered array of {@link ConversationItem} objects suitable for
 * rendering the chat UI.
 *
 * Each round may contribute a user item (when `inputRole === "user"`), one or
 * more assistant text items, and zero or more tool-call items, in the order
 * they appear in `assistantBlocks`.
 *
 * @param rounds - The raw thread rounds to convert.
 * @returns A flat list of conversation items in chronological order.
 */
export function buildConversationItems(rounds: ThreadRound[]): ConversationItem[] {
  const items: ConversationItem[] = [];

  for (const round of rounds) {
    if (round.inputRole === "user" && round.inputContent) {
      items.push({
        id: `${round.id}-user`,
        kind: "user",
        content: round.inputContent,
        timestamp: round.createdAt,
      });
    }

    round.assistantBlocks.forEach((block, index) => {
      if (block.type === "text") {
        if (!block.text) {
          return;
        }

        items.push({
          id: `${round.id}-text-${index}`,
          kind: "assistant_text",
          content: block.text,
          timestamp: round.createdAt,
        });
        return;
      }

      items.push({
        id: `${round.id}-tool-${block.toolCallId}`,
        kind: "tool_call",
        toolCallId: block.toolCallId,
        name: block.name,
        args: block.args,
        result: block.result,
        status: block.status,
        transport: block.transport,
        timestamp: round.createdAt,
      });
    });
  }

  return items;
}

/**
 * Core chat hook that manages conversation threads, streaming SSE responses,
 * and tool-call state for the Spike AI chat interface.
 *
 * Handles the full lifecycle of a chat session:
 * - Initialises by loading existing threads from the API on first mount.
 * - Streams assistant responses via Server-Sent Events, emitting incremental
 *   text deltas and tool-call start/end events.
 * - Persists the current thread ID in a ref so it is always up to date inside
 *   callbacks without causing unnecessary re-renders.
 * - Aborts any in-flight stream when the component unmounts or when `enabled`
 *   transitions to `false`.
 *
 * @param options.enabled - When `false` the hook clears all state and stops
 *   any active stream. Defaults to `true`.
 * @param options.persona - Optional persona identifier forwarded to the chat
 *   API endpoint to influence model behaviour.
 * @returns A {@link UseChatReturn} object containing conversation state and
 *   action callbacks.
 */
export function useChat({ enabled = true, persona }: UseChatOptions = {}): UseChatReturn {
  const [threads, setThreads] = useState<ChatThreadSummary[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [usageSnapshot, setUsageSnapshot] = useState<ChatUsageSnapshot | null>(null);
  const [contextWindow, setContextWindow] = useState(128_000);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const currentThreadIdRef = useRef<string | null>(null);
  const activeAssistantTextIdRef = useRef<string | null>(null);
  const didInitRef = useRef(false);

  // Abort any in-flight stream on unmount to prevent state updates on an
  // unmounted component and to release the underlying network connection.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    currentThreadIdRef.current = currentThreadId;
  }, [currentThreadId]);

  const usage = useMemo<ChatUsage | null>(() => {
    if (!usageSnapshot) {
      return null;
    }

    return {
      ...usageSnapshot,
      contextWindow,
    };
  }, [contextWindow, usageSnapshot]);

  const loadThread = useCallback(async (threadId: string) => {
    setIsLoadingHistory(true);

    try {
      const res = await fetch(apiUrl(`/chat/threads/${threadId}`), {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const payload = (await res.json()) as ThreadDetailResponse;
      currentThreadIdRef.current = payload.thread.id;
      setCurrentThreadId(payload.thread.id);
      setItems(buildConversationItems(payload.rounds));
      setUsageSnapshot(payload.thread.usage);
      activeAssistantTextIdRef.current = null;
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load thread";
      setError(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const refreshThreads = useCallback(
    async (options?: { selectFirst?: boolean }) => {
      if (!enabled) {
        return;
      }

      try {
        const res = await fetch(apiUrl("/chat/threads"), {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const payload = (await res.json()) as ThreadsResponse;
        setThreads(payload.threads);

        if (options?.selectFirst && !currentThreadIdRef.current && payload.threads[0]) {
          await loadThread(payload.threads[0].id);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load threads";
        setError(message);
      }
    },
    [enabled, loadThread],
  );

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      currentThreadIdRef.current = null;
      setThreads([]);
      setCurrentThreadId(null);
      setItems([]);
      setUsageSnapshot(null);
      setIsLoadingHistory(false);
      setIsStreaming(false);
      setError(null);
      didInitRef.current = false;
      activeAssistantTextIdRef.current = null;
      return;
    }

    void (async () => {
      try {
        const res = await fetch(apiUrl("/settings/public"));
        if (!res.ok) {
          return;
        }

        const payload = (await res.json()) as SettingsResponse;
        if (typeof payload.context_window === "number" && payload.context_window > 0) {
          setContextWindow(payload.context_window);
        }
      } catch {
        // Best-effort public settings load.
      }
    })();

    if (!didInitRef.current) {
      didInitRef.current = true;
      void refreshThreads({ selectFirst: true });
    }
  }, [enabled, refreshThreads]);

  const appendAssistantText = useCallback((text: string) => {
    setItems((prev) => {
      const existingId = activeAssistantTextIdRef.current;
      if (existingId) {
        return prev.map((item) =>
          item.kind === "assistant_text" && item.id === existingId
            ? { ...item, content: item.content + text }
            : item,
        );
      }

      const id = makeId("assistant");
      activeAssistantTextIdRef.current = id;

      return [
        ...prev,
        {
          id,
          kind: "assistant_text",
          content: text,
          timestamp: Date.now(),
        },
      ];
    });
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!enabled || isStreaming || !content.trim()) {
        return;
      }

      activeAssistantTextIdRef.current = null;
      setError(null);
      setIsStreaming(true);

      const trimmed = content.trim();
      const optimisticUserItem: UserConversationItem = {
        id: makeId("user"),
        kind: "user",
        content: trimmed,
        timestamp: Date.now(),
      };

      setItems((prev) => [...prev, optimisticUserItem]);

      try {
        abortRef.current = new AbortController();

        const res = await fetch(apiUrl("/chat"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            message: trimmed,
            ...(currentThreadIdRef.current ? { threadId: currentThreadIdRef.current } : {}),
            ...(persona ? { persona } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error((await res.text()) || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const lines = chunk.split("\n");
            let eventName = "message";
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
            }

            const rawData = dataLines.join("\n");
            if (!rawData || rawData === "[DONE]") {
              continue;
            }

            try {
              const payload = JSON.parse(rawData) as {
                type?: string;
                text?: string;
                error?: string;
                promptTokens?: number;
                completionTokens?: number;
                totalTokens?: number;
                thread?: ChatThreadSummary;
                toolCallId?: string;
                name?: string;
                args?: Record<string, unknown>;
                result?: string;
                status?: "pending" | "done" | "error";
                transport?: "browser" | "mcp";
              };

              const resolvedEvent = payload.type ?? eventName;

              if (resolvedEvent === "thread" && payload.thread) {
                currentThreadIdRef.current = payload.thread.id;
                setCurrentThreadId(payload.thread.id);
                void refreshThreads();
                continue;
              }

              if (resolvedEvent === "text_delta" && payload.text) {
                appendAssistantText(payload.text);
                continue;
              }

              if (
                resolvedEvent === "tool_call_start" &&
                payload.toolCallId &&
                payload.name &&
                payload.transport
              ) {
                activeAssistantTextIdRef.current = null;
                setItems((prev) => [
                  ...prev,
                  {
                    id: makeId("tool"),
                    kind: "tool_call",
                    toolCallId: payload.toolCallId,
                    name: payload.name,
                    args: payload.args ?? {},
                    status: payload.status ?? "pending",
                    transport: payload.transport,
                    timestamp: Date.now(),
                  },
                ]);
                continue;
              }

              if (resolvedEvent === "tool_call_end" && payload.toolCallId) {
                activeAssistantTextIdRef.current = null;
                setItems((prev) =>
                  prev.map((item) =>
                    item.kind === "tool_call" && item.toolCallId === payload.toolCallId
                      ? {
                          ...item,
                          result: payload.result,
                          status: payload.status ?? "done",
                          transport: payload.transport ?? item.transport,
                        }
                      : item,
                  ),
                );
                continue;
              }

              if (
                resolvedEvent === "usage" &&
                typeof payload.promptTokens === "number" &&
                typeof payload.completionTokens === "number" &&
                typeof payload.totalTokens === "number"
              ) {
                setUsageSnapshot({
                  promptTokens: payload.promptTokens,
                  completionTokens: payload.completionTokens,
                  totalTokens: payload.totalTokens,
                });
                void refreshThreads();
                continue;
              }

              if (resolvedEvent === "error") {
                setError(payload.error ?? "Unknown error");
              }
            } catch {
              // Ignore malformed SSE chunks.
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        const message = err instanceof Error ? err.message : "Failed to send message";
        setError(message);
        setItems((prev) => [
          ...prev,
          {
            id: makeId("assistant-error"),
            kind: "assistant_text",
            content: "Sorry, something went wrong. Please try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        activeAssistantTextIdRef.current = null;
        setIsStreaming(false);
        abortRef.current = null;
        void refreshThreads();
      }
    },
    [appendAssistantText, enabled, isStreaming, refreshThreads],
  );

  const selectThread = useCallback(
    async (threadId: string) => {
      if (!enabled || isStreaming) {
        return;
      }

      setUsageSnapshot(null);
      await loadThread(threadId);
    },
    [enabled, isStreaming, loadThread],
  );

  const newThread = useCallback(() => {
    if (isStreaming) {
      return;
    }

    activeAssistantTextIdRef.current = null;
    currentThreadIdRef.current = null;
    setCurrentThreadId(null);
    setItems([]);
    setUsageSnapshot(null);
    setError(null);
  }, [isStreaming]);

  const clearError = useCallback(() => setError(null), []);

  const submitBrowserResult = useCallback(async (toolCallId: string, result: unknown) => {
    const threadId = currentThreadIdRef.current;
    if (!threadId) {
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.kind === "tool_call" && item.toolCallId === toolCallId && !item.result
          ? {
              ...item,
              result: formatToolResult(result),
            }
          : item,
      ),
    );

    try {
      const res = await fetch(apiUrl("/chat/browser-results"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          threadId,
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
      setItems((prev) =>
        prev.map((item) =>
          item.kind === "tool_call" && item.toolCallId === toolCallId
            ? {
                ...item,
                status: "error",
                result: message,
              }
            : item,
        ),
      );
    }
  }, []);

  return {
    threads,
    currentThreadId,
    items,
    usage,
    isLoadingHistory,
    isStreaming,
    error,
    sendMessage,
    selectThread,
    newThread,
    clearError,
    submitBrowserResult,
  };
}
