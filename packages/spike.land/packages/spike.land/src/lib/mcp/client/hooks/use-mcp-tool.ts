"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { callTool } from "../mcp-client";

export interface UseMcpToolOptions<T, R> {
  enabled?: boolean;
  refetchInterval?: number;
  transform?: (data: T) => R;
  onSuccess?: (data: R) => void;
  onError?: (error: Error) => void;
}

export function useMcpTool<T = unknown, R = T>(
  name: string,
  args: unknown = {},
  options: UseMcpToolOptions<T, R> = {},
) {
  const {
    enabled = true,
    refetchInterval,
  } = options;

  const [data, setData] = useState<R | undefined>();
  const [error, setError] = useState<Error | undefined>();
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefetching, setIsRefetching] = useState(false);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const argsRef = useRef(args);
  argsRef.current = args;

  const isRefetchingRef = useRef(isRefetching);
  isRefetchingRef.current = isRefetching;

  const fetchData = useCallback(async (isManual = false) => {
    if (!isManual) {
      if (!isRefetchingRef.current) setIsLoading(true);
    } else {
      setIsRefetching(true);
    }

    try {
      const rawData = await callTool<T>(name, argsRef.current);
      const transform = optionsRef.current.transform;
      const processedData = transform
        ? transform(rawData)
        : (rawData as unknown as R);

      setData(processedData);
      setError(undefined);
      optionsRef.current.onSuccess?.(processedData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Unknown error");
      setError(error);
      optionsRef.current.onError?.(error);
    } finally {
      setIsLoading(false);
      setIsRefetching(false);
    }
  }, [name]);

  const argsKey = JSON.stringify(args);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, fetchData, argsKey]);

  useEffect(() => {
    if (enabled && refetchInterval) {
      const interval = setInterval(() => fetchData(true), refetchInterval);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [enabled, refetchInterval, fetchData]);

  return {
    data,
    error,
    isLoading,
    isRefetching,
    refetch: () => {
      if (optionsRef.current.enabled === false) return Promise.resolve();
      return fetchData(true);
    },
  };
}
