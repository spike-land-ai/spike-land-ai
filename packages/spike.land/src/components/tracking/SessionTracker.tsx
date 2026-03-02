"use client";

import { useSession } from "@/lib/auth/client/hooks";
import { logger } from "@/lib/logger";
import { hasConsent } from "@/lib/tracking/consent";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// Constants
const VISITOR_ID_KEY = "spike_visitor_id";
const SESSION_ID_KEY = "spike_session_id";
const UTM_CAPTURED_KEY = "spike_utm_captured";

// Scroll depth milestones to track
const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

// Time on page milestones (in seconds)
const TIME_MILESTONES = [30, 60, 180] as const;

// Debounce delay for API calls (ms)
const API_DEBOUNCE_MS = 1000;

/**
 * Generate a unique visitor ID
 */
function generateVisitorId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `v_${timestamp}_${randomPart}`;
}

/**
 * Get or create a visitor ID from localStorage
 */
function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;

  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
}

/**
 * Extract UTM parameters from URL
 */
function extractUtmParams(searchParams: URLSearchParams): {
  utmSource?: string | undefined;
  utmMedium?: string | undefined;
  utmCampaign?: string | undefined;
  utmTerm?: string | undefined;
  utmContent?: string | undefined;
  gclid?: string | undefined;
  fbclid?: string | undefined;
} {
  return {
    utmSource: searchParams.get("utm_source") || undefined,
    utmMedium: searchParams.get("utm_medium") || undefined,
    utmCampaign: searchParams.get("utm_campaign") || undefined,
    utmTerm: searchParams.get("utm_term") || undefined,
    utmContent: searchParams.get("utm_content") || undefined,
    gclid: searchParams.get("gclid") || undefined,
    fbclid: searchParams.get("fbclid") || undefined,
  };
}

/**
 * Get device and browser information
 */
function getDeviceInfo(): {
  deviceType: string;
  browser: string;
  os: string;
} {
  if (typeof window === "undefined") {
    return { deviceType: "unknown", browser: "unknown", os: "unknown" };
  }

  const ua = navigator.userAgent;

  // Detect device type
  let deviceType = "desktop";
  if (/Mobi|Android/i.test(ua)) {
    deviceType = /Tablet|iPad/i.test(ua) ? "tablet" : "mobile";
  }

  // Detect browser
  let browser = "unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    browser = "Chrome";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browser = "Safari";
  } else if (ua.includes("Firefox")) {
    browser = "Firefox";
  } else if (ua.includes("Edg")) {
    browser = "Edge";
  }

  // Detect OS
  let os = "unknown";
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = "iOS";
  }

  return { deviceType, browser, os };
}

/**
 * SessionTracker Component
 *
 * Handles all client-side tracking for campaign analytics:
 * - Session creation and management
 * - Page view tracking
 * - Scroll depth tracking
 * - Time on page tracking
 * - User linking on auth changes
 */
export function SessionTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: authSession, status: authStatus } = useSession();

  // Refs for tracking state
  const sessionIdRef = useRef<string | null>(null);
  const visitorIdRef = useRef<string | null>(null);
  const maxScrollDepthRef = useRef<number>(0);
  const trackedScrollMilestonesRef = useRef<Set<number>>(new Set());
  const trackedTimeMilestonesRef = useRef<Set<number>>(new Set());
  const pageStartTimeRef = useRef<number>(Date.now());
  const lastApiCallRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);
  const currentPathRef = useRef<string>(pathname);
  const pendingApiCallsRef = useRef<Promise<void>[]>([]);

  /**
   * Debounced API call wrapper
   */
  const debouncedApiCall = useCallback(
    async (endpoint: string, data: Record<string, unknown>): Promise<void> => {
      const now = Date.now();
      if (now - lastApiCallRef.current < API_DEBOUNCE_MS) {
        return;
      }
      lastApiCallRef.current = now;

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (response.status === 404) {
          // Session no longer exists in DB — clear stale ID so next load creates a fresh one
          sessionStorage.removeItem(SESSION_ID_KEY);
          sessionIdRef.current = null;
          isInitializedRef.current = false;
        } else if (!response.ok) {
          logger.warn(`[Tracking] API call failed: ${response.status}`);
        }
      } catch (error) {
        // Silently fail - tracking should not impact UX
        logger.warn("[Tracking] API call error", { error });
      }
    },
    [],
  );

  /**
   * Create or resume a session
   */
  const initializeSession = useCallback(async () => {
    if (!hasConsent()) return;
    if (isInitializedRef.current) return;

    // Set flag immediately to prevent race condition in React Strict Mode
    isInitializedRef.current = true;

    const visitorId = getOrCreateVisitorId();
    if (!visitorId) {
      isInitializedRef.current = false; // Reset if we can't get visitor ID
      return;
    }

    visitorIdRef.current = visitorId;

    // Check for existing session in sessionStorage
    const existingSessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (existingSessionId) {
      sessionIdRef.current = existingSessionId;
      return;
    }

    // Check if UTM params have already been captured this session
    const utmAlreadyCaptured = sessionStorage.getItem(UTM_CAPTURED_KEY) === "true";

    // Extract UTM params only on initial landing (not SPA navigation)
    const utmParams = utmAlreadyCaptured ? {} : extractUtmParams(searchParams);

    // Mark UTM as captured if we found any params
    if (
      !utmAlreadyCaptured &&
      (utmParams.utmSource || utmParams.gclid || utmParams.fbclid || utmParams.utmCampaign)
    ) {
      sessionStorage.setItem(UTM_CAPTURED_KEY, "true");
    }

    const deviceInfo = getDeviceInfo();

    try {
      const response = await fetch("/api/tracking/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          landingPage: pathname,
          referrer: document.referrer || undefined,
          ...deviceInfo,
          ...utmParams,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        sessionIdRef.current = data.sessionId;
        sessionStorage.setItem(SESSION_ID_KEY, data.sessionId);
        // Flag already set at start, keep it
      } else {
        // Reset flag on failure to allow retry
        isInitializedRef.current = false;
      }
    } catch (error) {
      logger.warn("[Tracking] Failed to initialize session", { error });
      // Reset flag on error to allow retry
      isInitializedRef.current = false;
    }
  }, [pathname, searchParams]);

  /**
   * Track a page view
   */
  const trackPageView = useCallback(
    async (path: string, title?: string) => {
      if (!hasConsent() || !sessionIdRef.current) return;

      // Skip if it's the same path (initial page is already tracked in session creation)
      if (path === currentPathRef.current && isInitializedRef.current) return;

      currentPathRef.current = path;

      await debouncedApiCall("/api/tracking/pageview", {
        sessionId: sessionIdRef.current,
        path,
        title: title || document.title,
      });
    },
    [debouncedApiCall],
  );

  /**
   * Track a custom event
   */
  const trackEvent = useCallback(
    async (name: string, category?: string, value?: number, metadata?: Record<string, unknown>) => {
      if (!hasConsent() || !sessionIdRef.current) return;

      await debouncedApiCall("/api/tracking/event", {
        sessionId: sessionIdRef.current,
        name,
        category,
        value,
        metadata,
      });
    },
    [debouncedApiCall],
  );

  /**
   * Track scroll depth
   */
  const handleScroll = useCallback(() => {
    if (!hasConsent() || !sessionIdRef.current) return;

    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return;

    const scrollPercentage = Math.round((window.scrollY / scrollHeight) * 100);
    maxScrollDepthRef.current = Math.max(maxScrollDepthRef.current, scrollPercentage);

    // Track milestones using the allowed event names
    for (const milestone of SCROLL_MILESTONES) {
      if (scrollPercentage >= milestone && !trackedScrollMilestonesRef.current.has(milestone)) {
        trackedScrollMilestonesRef.current.add(milestone);
        trackEvent(`page_scroll_${milestone}`, "engagement", milestone, {
          path: pathname,
        });
      }
    }
  }, [pathname, trackEvent]);

  /**
   * Track time on page milestones
   */
  const checkTimeMilestones = useCallback(() => {
    if (!hasConsent() || !sessionIdRef.current) return;

    const timeOnPage = Math.floor((Date.now() - pageStartTimeRef.current) / 1000);

    for (const milestone of TIME_MILESTONES) {
      if (timeOnPage >= milestone && !trackedTimeMilestonesRef.current.has(milestone)) {
        trackedTimeMilestonesRef.current.add(milestone);
        trackEvent(`time_on_page_${milestone}s`, "engagement", milestone, {
          path: pathname,
        });
      }
    }
  }, [pathname, trackEvent]);

  /**
   * Update session end time
   */
  const updateSessionEnd = useCallback(async () => {
    if (!sessionIdRef.current) return;

    // Wait for any pending API calls before ending
    await Promise.allSettled(pendingApiCallsRef.current);

    try {
      const response = await fetch("/api/tracking/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          sessionEnd: new Date().toISOString(),
        }),
        // Use keepalive to ensure the request completes even during page unload
        keepalive: true,
      });

      if (response.status === 404) {
        // Session no longer exists in DB — clear stale ID
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionIdRef.current = null;
        isInitializedRef.current = false;
      }
    } catch {
      // Intentionally silent: Page unload session end tracking is best-effort.
      // Cannot reliably log during unload and errors are expected for cancelled requests.
    }
  }, []);

  /**
   * Link session to user when they log in
   */
  const linkSessionToUser = useCallback(async (userId: string) => {
    if (!sessionIdRef.current) return;

    try {
      const response = await fetch("/api/tracking/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          userId,
        }),
      });

      if (response.status === 404) {
        // Session no longer exists in DB — clear stale ID
        sessionStorage.removeItem(SESSION_ID_KEY);
        sessionIdRef.current = null;
        isInitializedRef.current = false;
      }
    } catch (error) {
      logger.warn("[Tracking] Failed to link session to user", { error });
    }
  }, []);

  // Initialize session on mount
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // Track page views on route changes
  useEffect(() => {
    if (isInitializedRef.current && pathname !== currentPathRef.current) {
      // Reset page-specific tracking
      maxScrollDepthRef.current = 0;
      trackedScrollMilestonesRef.current.clear();
      trackedTimeMilestonesRef.current.clear();
      pageStartTimeRef.current = Date.now();

      trackPageView(pathname);
    }
  }, [pathname, trackPageView]);

  // Link session to user when auth status changes
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user?.id) {
      linkSessionToUser(authSession.user.id);
    }
  }, [authStatus, authSession?.user?.id, linkSessionToUser]);

  // Set up scroll tracking
  useEffect(() => {
    if (!hasConsent()) return;

    const throttledScroll = (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return () => {
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          handleScroll();
          timeoutId = null;
        }, 200);
      };
    })();

    window.addEventListener("scroll", throttledScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", throttledScroll);
    };
  }, [handleScroll]);

  // Set up time tracking
  useEffect(() => {
    if (!hasConsent()) return;

    const intervalId = setInterval(checkTimeMilestones, 5000);
    return () => clearInterval(intervalId);
  }, [checkTimeMilestones]);

  // Handle visibility change (pause/resume tracking)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // Page is hidden - update session end time
        updateSessionEnd();
      } else {
        // Page is visible again - reset time tracking for this page
        pageStartTimeRef.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [updateSessionEnd]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      updateSessionEnd();
    };
  }, [updateSessionEnd]);

  // This component renders nothing
  return null;
}
