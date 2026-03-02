import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "@tanstack/react-router";
import { stdbClient } from "@/lib/stdb";

interface QueuedEvent {
  event: string;
  data: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_BATCH_SIZE = 10;

const eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushEvents() {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, eventQueue.length);
  for (const { event, data } of batch) {
    stdbClient.recordEvent(event, data);
  }
}

function enqueueEvent(event: string, data: Record<string, unknown>) {
  eventQueue.push({ event, data });

  if (eventQueue.length >= FLUSH_BATCH_SIZE) {
    flushEvents();
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEvents();
    }, FLUSH_INTERVAL_MS);
  }
}

export function useAnalytics() {
  const router = useRouter();
  const sessionStart = useRef(Date.now());

  useEffect(() => {
    const unsubscribe = router.subscribe("onResolved", (match) => {
      enqueueEvent("page_view", {
        path: match.toLocation.pathname,
        timestamp: Date.now(),
        sessionDuration: Date.now() - sessionStart.current,
      });
    });

    // Flush remaining events on unmount
    return () => {
      unsubscribe();
      flushEvents();
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
    };
  }, [router]);

  const trackPageView = useCallback((route: string) => {
    enqueueEvent("page_view", {
      path: route,
      timestamp: Date.now(),
      sessionDuration: Date.now() - sessionStart.current,
    });
  }, []);

  const trackToolInvocation = useCallback((toolName: string, durationMs?: number) => {
    enqueueEvent("tool_use", {
      toolName,
      durationMs,
      timestamp: Date.now(),
    });
  }, []);

  const trackCustomEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    enqueueEvent(eventType, {
      ...metadata,
      timestamp: Date.now(),
    });
  }, []);

  return {
    trackPageView,
    trackToolInvocation,
    trackCustomEvent,
    trackEvent(event: string, data?: Record<string, unknown>) {
      enqueueEvent(event, { ...data, timestamp: Date.now() });
    },
  };
}
