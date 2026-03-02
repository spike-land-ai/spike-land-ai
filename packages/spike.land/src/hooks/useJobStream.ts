import type { JobStatus, PipelineStage } from "@prisma/client";
import { useCallback, useEffect, useRef, useState } from "react";

import { tryCatchSync } from "@/lib/try-catch";

interface JobStreamData {
  type: "status" | "error" | "connected";
  status?: JobStatus;
  currentStage?: PipelineStage | null;
  enhancedUrl?: string | null;
  enhancedWidth?: number | null;
  enhancedHeight?: number | null;
  errorMessage?: string | null;
  message?: string;
}

interface Job {
  id: string;
  status: JobStatus;
  currentStage: PipelineStage | null;
  enhancedUrl: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  errorMessage: string | null;
}

interface UseJobStreamOptions {
  jobId: string | null;
  onComplete?: (job: Job) => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: JobStatus) => void;
}

/**
 * Hook for real-time job status updates via Server-Sent Events
 *
 * Replaces polling with SSE for instant status updates.
 * Automatically reconnects on connection loss.
 */
export function useJobStream({ jobId, onComplete, onError, onStatusChange }: UseJobStreamOptions) {
  const [job, setJob] = useState<Job | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Use refs for stable callback references to prevent memory pressure
  // from frequent callback recreations in long-running sessions
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onStatusChangeRef = useRef(onStatusChange);

  // Update refs when callbacks change
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onError;
    onStatusChangeRef.current = onStatusChange;
  }, [onComplete, onError, onStatusChange]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const result = tryCatchSync<JobStreamData>(() => JSON.parse(event.data));

      if (result.error) {
        console.error("Failed to parse SSE message:", result.error);
        return;
      }

      const data = result.data;

      if (data.type === "connected") {
        setIsConnected(true);
        setConnectionError(null);
        return;
      }

      if (data.type === "error") {
        setConnectionError(data.message || "Unknown error");
        onErrorRef.current?.(data.message || "Unknown error");
        return;
      }

      if (data.type === "status" && data.status && jobId) {
        const jobData: Job = {
          id: jobId,
          status: data.status,
          currentStage: data.currentStage || null,
          enhancedUrl: data.enhancedUrl || null,
          enhancedWidth: data.enhancedWidth || null,
          enhancedHeight: data.enhancedHeight || null,
          errorMessage: data.errorMessage || null,
        };

        setJob(jobData);
        onStatusChangeRef.current?.(data.status);

        if (data.status === "COMPLETED") {
          onCompleteRef.current?.(jobData);
        } else if (data.status === "FAILED") {
          onErrorRef.current?.(data.errorMessage || "Enhancement failed");
        }
      }
    },
    [jobId], // Only depends on jobId now, refs are stable
  );

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      setIsConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      eventSource = new EventSource(`/api/jobs/${jobId}/stream`);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        setConnectionError(null);
      };

      eventSource.onmessage = handleMessage;

      eventSource.onerror = () => {
        setIsConnected(false);

        // Don't reconnect if stream was intentionally closed
        if (eventSource?.readyState === EventSource.CLOSED) {
          return;
        }

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
          reconnectAttempts++;

          reconnectTimeout = setTimeout(() => {
            eventSource?.close();
            connect();
          }, delay);
        } else {
          setConnectionError("Connection lost. Please refresh the page.");
          onErrorRef.current?.("Connection lost");
        }
      };
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      eventSource?.close();
      setIsConnected(false);
    };
  }, [jobId, handleMessage]); // Removed onError from deps, using ref instead

  return {
    job,
    isConnected,
    connectionError,
  };
}
