import { useState, useCallback } from "react";
import { callTool, parseToolResult } from "@/api/client";

interface UseToolState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  execute: (args?: Record<string, unknown>) => Promise<T | null>;
  reset: () => void;
}

export function useTool<T = unknown>(toolName: string): UseToolState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(
    async (args: Record<string, unknown> = {}): Promise<T | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await callTool(toolName, args);
        const parsed = parseToolResult<T>(result);
        setData(parsed);
        return parsed;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toolName],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, execute, reset };
}
