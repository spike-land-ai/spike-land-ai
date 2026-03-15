import { useState, useCallback, useRef, useEffect } from "react";

export interface RadixMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export type PipelineStage = "classify" | "plan" | "execute" | "extract" | "idle";

interface UseRadixChatReturn {
  messages: RadixMessage[];
  sendMessage: (content: string) => Promise<void>;
  isStreaming: boolean;
  currentStage: PipelineStage;
  error: string | null;
  clearError: () => void;
  clearMessages: () => void;
}

const VALID_STAGES: ReadonlySet<string> = new Set<PipelineStage>([
  "classify",
  "plan",
  "execute",
  "extract",
  "idle",
]);

function toPipelineStage(value: string | undefined): PipelineStage {
  return value !== undefined && VALID_STAGES.has(value) ? (value as PipelineStage) : "idle";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function getBaseURL(): string {
  if (typeof window === "undefined") return "https://spike.land";
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8787";
  }
  if (hostname === "local.spike.land") {
    return "https://local.spike.land:8787";
  }
  if (
    hostname === "spike.land" ||
    hostname === "www.spike.land" ||
    hostname === "analytics.spike.land"
  ) {
    return window.location.origin;
  }
  return "https://spike.land";
}

function loadStoredMessages(storageKey: string): RadixMessage[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RadixMessage =>
        isObject(item) &&
        typeof item["id"] === "string" &&
        (item["role"] === "user" || item["role"] === "assistant"),
    );
  } catch {
    return [];
  }
}

let nextId = 0;
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${++nextId}`;
}

export function useRadixChat(persona: string = "radix"): UseRadixChatReturn {
  const storageKey = `${persona}-chat-messages`;

  const [messages, setMessages] = useState<RadixMessage[]>(() => loadStoredMessages(storageKey));
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist messages to localStorage (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [messages, storageKey]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      const userMsg: RadixMessage = {
        id: makeId(persona),
        role: "user",
        content: content.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);
      setCurrentStage("classify");
      setError(null);

      const assistantMsg: RadixMessage = {
        id: makeId(persona),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMsg]);

      try {
        abortRef.current = new AbortController();

        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const baseURL = getBaseURL();
        const res = await fetch(`${baseURL}/api/spike-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-guest-access": "true",
          },
          credentials: "include",
          body: JSON.stringify({
            message: content.trim(),
            history,
            persona,
          }),
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
            if (line.startsWith("id: ")) continue;
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
    [isStreaming, messages, persona],
  );

  const clearError = useCallback(() => setError(null), []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    messages,
    sendMessage,
    isStreaming,
    currentStage,
    error,
    clearError,
    clearMessages,
  };
}
