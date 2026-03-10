import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "@tanstack/react-router";

const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID ?? "G-9WNEM9ZHE7";

/**
 * Push a page_view hit to GA4 for SPA navigations.
 * Only fires when gtag is available (i.e. consent granted and script loaded).
 */
function pushGtagPageView(path: string, title: string): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
    send_to: GA4_MEASUREMENT_ID,
  });
}

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

/**
 * Mirror high-value conversion events to GA4 alongside the internal ingest
 * pipeline so they appear in GA4 reports and Google Ads attribution.
 */
function pushGtagCustomEvent(eventName: string, data: Record<string, unknown>): void {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, { send_to: GA4_MEASUREMENT_ID, ...data });
}

/** Events that should be mirrored to GA4 in addition to internal ingest. */
const GA4_MIRRORED_EVENTS = new Set([
  "checkout_started",
  "signup_completed",
  "app_view",
  "app_install",
  "blog_view",
  "credit_purchase_started",
  "migration_interest",
  "migration_checkout_started",
  "migration_page_view",
  "migration_tier_click",
]);

function enqueueEvent(event: string, data: Record<string, unknown>) {
  if (!hasAnalyticsConsent()) return;
  // Deduplicate consecutive page_view for the same path
  if (event === "page_view") {
    const path = data.path as string | undefined;
    if (path && path === lastPageViewPath) return;
    lastPageViewPath = path ?? null;
  }

  // Mirror selected conversion events to GA4
  if (GA4_MIRRORED_EVENTS.has(event)) {
    pushGtagCustomEvent(event, data);
  }

  eventQueue.push({ event, data });

  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushEvents();
    return;
  }

  scheduleFlush();
}

/**
 * Called by useCookieConsent after the user grants consent so any events
 * that arrived before consent is stored are flushed immediately.
 */
export function flushAnalyticsQueue(): void {
  flushEvents();
}

export function trackAnalyticsPageView(route: string, sessionDuration = 0): void {
  enqueueEvent("page_view", {
    path: route,
    sessionDuration,
  });
}

export function trackAnalyticsToolInvocation(toolName: string, durationMs?: number): void {
  enqueueEvent("tool_use", { toolName, durationMs });
}

export function trackAnalyticsCustomEvent(
  eventType: string,
  metadata?: Record<string, unknown>,
): void {
  enqueueEvent(eventType, { ...metadata });
}

export function trackAnalyticsEvent(event: string, data?: Record<string, unknown>): void {
  enqueueEvent(event, { ...data });
}

export function useAnalytics() {
  const router = useRouter();
  const sessionStart = useRef(Date.now());
  const lastNavPath = useRef<string | null>(null);
  const initialTracked = useRef(false);

  useEffect(() => {
    // Track the initial hard load. pushGtagPageView fires regardless of consent
    // (GA4 Consent Mode v2 applies modeled conversion data). enqueueEvent is
    // consent-gated so it only reaches /analytics/ingest when accepted.
    if (!initialTracked.current) {
      initialTracked.current = true;
      const initialPath = window.location.pathname;
      lastNavPath.current = initialPath;
      pushGtagPageView(initialPath, document.title);
      enqueueEvent("page_view", {
        path: initialPath,
        title: document.title,
        sessionDuration: 0,
      });
    }

    // Only track actual navigations (path changes), not re-renders
    const unsubscribe = router.subscribe("onResolved", (match) => {
      const path = match.toLocation.pathname;
      if (path === lastNavPath.current) return;
      lastNavPath.current = path;

      // Push to GA4 for SPA route changes (title may not yet be updated by the
      // route effect, but GA4 debug tools accept page_path as the canonical key)
      pushGtagPageView(path, document.title);

      enqueueEvent("page_view", {
        path,
        title: document.title,
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
    trackAnalyticsPageView(route, Date.now() - sessionStart.current);
  }, []);

  const trackToolInvocation = useCallback((toolName: string, durationMs?: number) => {
    trackAnalyticsToolInvocation(toolName, durationMs);
  }, []);

  const trackCustomEvent = useCallback((eventType: string, metadata?: Record<string, unknown>) => {
    trackAnalyticsCustomEvent(eventType, metadata);
  }, []);

  return {
    trackPageView,
    trackToolInvocation,
    trackCustomEvent,
    trackEvent(event: string, data?: Record<string, unknown>) {
      trackAnalyticsEvent(event, data);
    },
  };
}
