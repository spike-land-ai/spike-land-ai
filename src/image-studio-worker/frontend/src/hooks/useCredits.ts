import { useState, useEffect, useCallback } from "react";
import { callTool, parseToolResult } from "@/api/client";

export function useCredits(options: { enabled?: boolean } = { enabled: true }) {
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!options.enabled) {
      setLoading(false);
      return;
    }

    try {
      const result = await callTool("img_credits");
      const data = parseToolResult<{ remaining: number }>(result);
      setBalance(data.remaining);
    } catch {
      // Silently fail - balance stays at last known value
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options.enabled) {
      refresh();
      const interval = setInterval(refresh, 30000);
      return () => clearInterval(interval);
    }
  }, [refresh, options.enabled]);

  return { balance, loading, refresh };
}
