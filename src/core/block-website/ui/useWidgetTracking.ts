import { useEffect, useRef, useCallback } from "react";
import { apiUrl } from "../core-logic/api";

type WidgetEventType =
  | "widget_impression"
  | "slider_start"
  | "slider_change"
  | "slider_final"
  | "fistbump_click"
  | "donate_click"
  | "custom_toggle"
  | "custom_value"
  | "share_click"
  | "visibility_time"
  | "checkout_started"
  | "checkout_completed"
  | "thankyou_viewed";

interface TrackedEvent {
  clientId: string;
  slug: string;
  eventType: WidgetEventType;
  eventData: Record<string, unknown>;
  experimentId: string | null;
  variantId: string | null;
  timestamp: number;
}

interface ExperimentAssignment {
  variantId: string;
}

const CLIENT_ID_KEY = "spike_client_id";
const FLUSH_INTERVAL_MS = 5_000;
const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function readClientId(): string {
  try {
    return localStorage.getItem(CLIENT_ID_KEY) ?? "anonymous";
  } catch {
    return "anonymous";
  }
}

function getAllAssignments(
  assignments: Record<string, ExperimentAssignment>,
): Array<{ experimentId: string; variantId: string }> {
  return Object.entries(assignments).map(([experimentId, a]) => ({
    experimentId,
    variantId: a.variantId,
  }));
}

export function useWidgetTracking(
  slug: string,
  assignments: Record<string, { variantId: string }>,
) {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const queueRef = useRef<TrackedEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const impressionFiredRef = useRef(false);
  const visibilityEntryTimeRef = useRef<number | null>(null);
  const assignmentsRef = useRef(assignments);

  // Rolling window of event timestamps for rate limiting
  const eventTimestampsRef = useRef<number[]>([]);

  // Keep assignments ref current without triggering re-renders
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  const flush = useCallback(() => {
    if (queueRef.current.length === 0) return;

    const events = queueRef.current.splice(0, queueRef.current.length);
    const payload = JSON.stringify({ events });

    try {
      navigator.sendBeacon(apiUrl("/experiments/track"), payload);
    } catch {
      // sendBeacon not available — fall back to fetch (best effort)
      fetch(apiUrl("/experiments/track"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Discard on failure — tracking is non-critical
      });
    }
  }, []);

  const track = useCallback(
    (
      eventType: WidgetEventType,
      eventData: Record<string, unknown> = {},
    ) => {
      const now = Date.now();

      // Prune timestamps outside the rolling 1-minute window
      eventTimestampsRef.current = eventTimestampsRef.current.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
      );

      // Enforce rate limit
      if (eventTimestampsRef.current.length >= RATE_LIMIT_MAX) {
        return;
      }

      const clientId = readClientId();
      const pairs = getAllAssignments(assignmentsRef.current);

      if (pairs.length === 0) {
        // No experiments active — still record the event untagged
        eventTimestampsRef.current.push(now);
        queueRef.current.push({
          clientId,
          slug,
          eventType,
          eventData,
          experimentId: null,
          variantId: null,
          timestamp: now,
        });
        return;
      }

      // Emit one event per active experiment so every experiment gets metrics
      for (const { experimentId, variantId } of pairs) {
        eventTimestampsRef.current.push(now);
        queueRef.current.push({
          clientId,
          slug,
          eventType,
          eventData,
          experimentId,
          variantId,
          timestamp: now,
        });
      }
    },
    [slug],
  );

  // Set up periodic flush interval
  useEffect(() => {
    flushTimerRef.current = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      if (flushTimerRef.current !== null) {
        clearInterval(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };
  }, [flush]);

  // Flush remaining events on page unload
  useEffect(() => {
    function handleUnload() {
      // Send any pending visibility_time event
      if (visibilityEntryTimeRef.current !== null) {
        const durationMs = Date.now() - visibilityEntryTimeRef.current;
        track("visibility_time", { duration_ms: durationMs });
        visibilityEntryTimeRef.current = null;
      }
      flush();
    }

    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [flush, track]);

  // IntersectionObserver for widget_impression and visibility_time
  useEffect(() => {
    const element = widgetRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibilityEntryTimeRef.current = Date.now();

            // Fire widget_impression only once per mount
            if (!impressionFiredRef.current) {
              impressionFiredRef.current = true;
              track("widget_impression");
            }
          } else {
            // Widget left viewport — emit accumulated visibility_time
            if (visibilityEntryTimeRef.current !== null) {
              const durationMs = Date.now() - visibilityEntryTimeRef.current;
              track("visibility_time", { duration_ms: durationMs });
              visibilityEntryTimeRef.current = null;
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [track]);

  return { widgetRef, track };
}
