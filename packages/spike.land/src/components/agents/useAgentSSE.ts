"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AgentSSEEvent {
  type:
    | "agent_connected"
    | "agent_disconnected"
    | "agent_status_changed"
    | "agent_activity"
    | "task_update";
  agentId: string;
  data: unknown;
  timestamp: number;
}

interface UseAgentSSEOptions {
  onEvent?: (event: AgentSSEEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

interface UseAgentSSEReturn {
  isConnected: boolean;
  lastEvent: AgentSSEEvent | null;
  error: Error | null;
  reconnect: () => void;
}

export function useAgentSSE(options: UseAgentSSEOptions = {}): UseAgentSSEReturn {
  const { onEvent, onConnect, onDisconnect, onError, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<AgentSSEEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const lastEventIdRef = useRef<string>("");
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const url = new URL("/api/agents/stream", window.location.origin);
    if (lastEventIdRef.current) {
      url.searchParams.set("lastEventId", lastEventIdRef.current);
    }

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
      onConnect?.();
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      const err = new Error("SSE connection error");
      setError(err);
      onError?.(err);
      onDisconnect?.();

      // Reconnect with exponential backoff
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connect();
        }
      }, delay);
    };

    // Listen for specific event types
    const eventTypes = [
      "agent_connected",
      "agent_disconnected",
      "agent_status_changed",
      "agent_activity",
      "task_update",
      "heartbeat",
    ];

    for (const eventType of eventTypes) {
      eventSource.addEventListener(eventType, (e: MessageEvent) => {
        if (eventType === "heartbeat") {
          // Just keep the connection alive
          return;
        }

        try {
          const data = JSON.parse(e.data) as AgentSSEEvent;
          lastEventIdRef.current = data.timestamp.toString();
          setLastEvent(data);
          onEvent?.(data);
        } catch (err) {
          console.error("Failed to parse SSE event:", err);
        }
      });
    }
  }, [enabled, onConnect, onDisconnect, onError, onEvent]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttempts.current = 0;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    lastEvent,
    error,
    reconnect,
  };
}
