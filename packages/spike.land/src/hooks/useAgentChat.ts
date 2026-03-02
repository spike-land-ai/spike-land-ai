"use client";

import { useCallback, useRef, useState } from "react";
import { type AgentSSEEvent, parseSSE, splitSSEBuffer } from "@/lib/chat/agent-sse-protocol";

/** A single content block within an agent message. */
export type AgentContentBlock =
  | { type: "text"; content: string }
  | { type: "image"; content: string; name?: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      serverName: string;
      input: Record<string, unknown>;
      status: "running" | "done" | "error";
      result?: string;
      isError?: boolean;
    };

/** A message in the agent conversation. */
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  blocks: AgentContentBlock[];
  timestamp: number;
}

export interface UseAgentChatReturn {
  messages: AgentMessage[];
  isStreaming: boolean;
  currentTurn: number;
  maxTurns: number;
  error: string | null;
  sendMessage: (
    question: string,
    attachments?: { type: string; data: string; name: string }[],
  ) => Promise<void>;
  clearMessages: () => void;
  abort: () => void;
}

/**
 * React hook for consuming the agentic chat SSE stream.
 *
 * Replaces useChatStream with rich message state supporting
 * text blocks and tool call blocks.
 */
export function useAgentChat(
  sessionId: string,
  endpoint = "/api/agent-loop",
  extraBody?: Record<string, string>,
): UseAgentChatReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [maxTurns, setMaxTurns] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (question: string, attachments?: { type: string; data: string; name: string }[]) => {
      if (isStreaming) return;

      setError(null);
      setIsStreaming(true);
      setCurrentTurn(0);
      setMaxTurns(0);

      const userBlocks: AgentContentBlock[] = [];
      if (attachments?.length) {
        for (const att of attachments) {
          userBlocks.push({ type: "image", content: att.data, name: att.name });
        }
      }
      userBlocks.push({ type: "text", content: question });

      // Add user message
      const userMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: "user",
        blocks: userBlocks,
        timestamp: Date.now(),
      };

      // Add placeholder assistant message
      const assistantId = crypto.randomUUID();
      const assistantMsg: AgentMessage = {
        id: assistantId,
        role: "assistant",
        blocks: [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            sessionId,
            attachments,
            ...extraBody,
          }),
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

          const parsedEvents: AgentSSEEvent[] = [];
          for (const line of events) {
            const event = parseSSE(line);
            if (event) parsedEvents.push(event);
          }

          if (parsedEvents.length > 0) {
            applyEvents(
              assistantId,
              parsedEvents,
              setMessages,
              setCurrentTurn,
              setMaxTurns,
              setError,
            );
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
    setCurrentTurn(0);
    setMaxTurns(0);
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  return {
    messages,
    isStreaming,
    currentTurn,
    maxTurns,
    error,
    sendMessage,
    clearMessages,
    abort,
  };
}

/** Apply a batch of SSE events to the state. */
function applyEvents(
  assistantId: string,
  events: AgentSSEEvent[],
  setMessages: React.Dispatch<React.SetStateAction<AgentMessage[]>>,
  setCurrentTurn: React.Dispatch<React.SetStateAction<number>>,
  setMaxTurns: React.Dispatch<React.SetStateAction<number>>,
  setError: React.Dispatch<React.SetStateAction<string | null>>,
) {
  let hasMessageUpdates = false;

  for (const event of events) {
    if (event.type === "turn_start") {
      setCurrentTurn(event.turn);
      setMaxTurns(event.maxTurns);
    } else if (event.type === "error") {
      setError(event.message);
    } else if (
      event.type === "text_delta" ||
      event.type === "tool_call_start" ||
      event.type === "tool_call_end"
    ) {
      hasMessageUpdates = true;
    }
  }

  if (hasMessageUpdates) {
    setMessages((prev) =>
      updateAssistant(prev, assistantId, (msg) => {
        const currentBlocks = [...msg.blocks];

        for (const event of events) {
          if (event.type === "text_delta") {
            const lastBlock = currentBlocks[currentBlocks.length - 1];
            if (lastBlock && lastBlock.type === "text") {
              // Update existing text block
              currentBlocks[currentBlocks.length - 1] = {
                ...lastBlock,
                content: lastBlock.content + event.text,
              };
            } else {
              // Append new text block
              currentBlocks.push({ type: "text", content: event.text });
            }
          } else if (event.type === "tool_call_start") {
            currentBlocks.push({
              type: "tool_call",
              id: event.id,
              name: event.name,
              serverName: event.serverName,
              input: event.input,
              status: "running" as const,
            });
          } else if (event.type === "tool_call_end") {
            const index = currentBlocks.findIndex(
              (b) => b.type === "tool_call" && b.id === event.id,
            );
            if (index !== -1) {
              const block = currentBlocks[index];
              if (block && block.type === "tool_call") {
                currentBlocks[index] = {
                  ...block,
                  status: event.isError ? "error" : "done",
                  result: event.result,
                  isError: event.isError,
                };
              }
            }
          }
        }
        return { ...msg, blocks: currentBlocks };
      }),
    );
  }
}

/** Immutably update the assistant message with the given id. */
function updateAssistant(
  messages: AgentMessage[],
  id: string,
  updater: (msg: AgentMessage) => AgentMessage,
): AgentMessage[] {
  return messages.map((msg) => (msg.id === id ? updater(msg) : msg));
}
