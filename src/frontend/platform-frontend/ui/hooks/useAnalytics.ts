import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

interface QueuedEvent {
  event: string;
  data: Record<string, unknown>;
}

const FLUSH_INTERVAL_MS = 30_000;
const MAX_QUEUE_SIZE = 20;
const BACKOFF_INTERVAL_MS = 120_000;

const eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let currentFlushInterval = FLUSH_INTERVAL_MS;
let lastPageViewPath: string | null = null;

function flushEvents() {
  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, eventQueue.length);

  const payload = batch.map((item) => ({
    source: "spike-app",
    eventType: item.event,
    metadata: item.data,
  }));

  const body = JSON.stringify(payload);

  try {
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden" &&
      navigator.sendBeacon
    ) {
      navigator.sendBeacon("/analytics/ingest", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/analytics/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      })
        .then((res) => {
          if (res.status === 429) {
            currentFlushInterval = BACKOFF_INTERVAL_MS;
            setTimeout(() => {
              currentFlushInterval = FLUSH_INTERVAL_MS;
            }, BACKOFF_INTERVAL_MS);
          }
        })
        .catch(() => {
          // Silently drop — analytics should never disrupt the app
        });
    }
  } catch {
    // Silently drop
  }
}

function scheduleFlush() {
  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEvents();
    }, currentFlushInterval);
  }
}

function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem("cookie_consent") === "accepted";
  } catch {
    return false;
  }
}

function enqueueEvent(event: string, data: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  // Deduplicate consecutive page_view for the same path
  if (event === "page_view") {
    const path = data.path as string | undefined;
    if (path && path === lastPageViewPath) return;
    lastPageViewPath = path ?? null;
  }

  eventQueue.push({ event, data });

  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
    return;
  }

  scheduleFlush();
}

export function useAnalytics() {
  const router = useRouter();
  const sessionStart = useRef(Date.now());
  const lastNavPath = useRef<string | null>(null);

  useEffect(() => {
    // Only track actual navigations (path changes), not re-renders
    const unsubscribe = router.subscribe("onResolved", (match) => {
      const path = match.toLocation.pathname;
      if (path === lastNavPath.current) return;
      lastNavPath.current = path;

      enqueueEvent("page_view", {
        path,
        sessionDuration: Date.now() - sessionStart.current,
      });
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushEvents();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibilityChange);
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
      sessionDuration: Date.now() - sessionStart.current,
    });
  }, []);

  const trackToolInvocation = useCallback((toolName: string, durationMs?: number) => {
    enqueueEvent("tool_use", { toolName, durationMs });
  }, []);

  const trackCustomEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    enqueueEvent(eventType, { ...metadata });
  }, []);

  return {
    trackPageView,
    trackToolInvocation,
    trackCustomEvent,
    trackEvent(event: string, data?: Record<string, unknown>) {
      enqueueEvent(event, { ...data });
    },
  };
}
