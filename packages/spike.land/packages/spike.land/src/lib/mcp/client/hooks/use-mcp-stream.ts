"use client";

import { useCallback, useRef, useState } from "react";
import { tokenManager } from "../token-manager";

export interface UseMcpStreamOptions {
  onChunk?: (chunk: string) => void;
  onDone?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export function useMcpStream(
  name: string,
  options: UseMcpStreamOptions = {},
) {
  const [chunks, setChunks] = useState<string[]>([]);
  const [fullText, setFullText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const eventSourceRef = useRef<EventSource | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const fullTextRef = useRef("");

  const start = useCallback(async (args: unknown = {}) => {
    // Reset state
    setChunks([]);
    setFullText("");
    fullTextRef.current = "";
    setIsDone(false);
    setError(undefined);

    const token = await tokenManager.getToken();
    if (!token) {
      const err = new Error("Unauthorized");
      setError(err);
      optionsRef.current.onError?.(err);
      return;
    }

    const url = new URL("/api/mcp", window.location.origin);
    url.searchParams.set("method", "tools/call");
    url.searchParams.set("name", name);
    url.searchParams.set("arguments", JSON.stringify(args));
    url.searchParams.set("token", token);
    url.searchParams.set("stream", "true");

    const es = new EventSource(url.toString());
    eventSourceRef.current = es;

    es.onmessage = event => {
      try {
        const data = JSON.parse(event.data) as {
          result?: { content?: Array<{ type: string; text?: string; }>; };
          isDone?: boolean;
        };

        // Handle MCP result content
        if (data.result?.content) {
          const text = data.result.content
            .filter(c => c.type === "text")
            .map(c => c.text)
            .join("");

          if (text) {
            setChunks(prev => [...prev, text]);
            fullTextRef.current += text;
            setFullText(fullTextRef.current);
            optionsRef.current.onChunk?.(text);
          }
        }

        if (data.isDone) {
          es.close();
          setIsDone(true);
          optionsRef.current.onDone?.(fullTextRef.current);
        }
      } catch (err) {
        console.error("Error parsing SSE message:", err);
      }
    };

    es.onerror = err => {
      console.error("SSE error:", err);
      es.close();
      const error = new Error("Stream connection failed");
      setError(error);
      optionsRef.current.onError?.(error);
    };

    return () => es.close();
  }, [name]);

  const stop = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsDone(true);
    }
  }, []);

  return {
    chunks,
    fullText,
    isDone,
    error,
    start,
    stop,
  };
}
