import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The analytics module has module-level mutable state (eventQueue, flushTimer,
// lastPageViewPath). We reset modules before each test so that state starts clean.

// ── Stable mocks (established before any module import) ──────────────────────

const mockUnsubscribe = vi.fn();
const mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ subscribe: mockSubscribe }),
}));

// Flatten React hooks so we can call hook logic synchronously in tests.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useCallback: (fn: (...args: unknown[]) => unknown) => fn,
    useEffect: (fn: () => void | (() => void)) => fn(),
    useRef: (val: unknown) => ({ current: val }),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function freshModule() {
  vi.resetModules();
  return import("@/ui/hooks/useAnalytics");
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useAnalytics", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockSendBeacon: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();

    mockFetch = vi.fn().mockResolvedValue({ status: 200 } as Response);
    vi.stubGlobal("fetch", mockFetch);

    mockSendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: mockSendBeacon, userAgent: "test-agent" });

    // Grant analytics consent
    localStorage.setItem("cookie_consent", "accepted");

    mockSubscribe.mockClear();
    mockUnsubscribe.mockClear();

    // Reset document visibility to visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  // ── trackCustomEvent → flush ──────────────────────────────────────────────

  it("trackCustomEvent enqueues and POSTs to /analytics/ingest with correct payload shape", async () => {
    const { useAnalytics } = await freshModule();
    const analytics = useAnalytics();

    // The hook fires an initial page_view in useEffect. Flush it so the queue
    // is empty, then enqueue our custom event.
    vi.advanceTimersByTime(35_000);
    mockFetch.mockClear();

    analytics.trackCustomEvent("test_event", { key: "value" });
    vi.advanceTimersByTime(35_000);

    expect(mockFetch).toHaveBeenCalledWith(
      "/analytics/ingest",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }),
    );

    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      source: string;
      eventType: string;
      metadata: Record<string, unknown>;
    }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]!.source).toBe("spike-app");
    expect(body[0]!.eventType).toBe("test_event");
    expect(body[0]!.metadata.key).toBe("value");
  });

  it("trackEvent enqueues an event with correct source and eventType", async () => {
    const { useAnalytics } = await freshModule();
    const analytics = useAnalytics();

    // Drain initial page_view
    vi.advanceTimersByTime(35_000);
    mockFetch.mockClear();

    analytics.trackEvent("custom_test", { key1: "val1", key2: 42 });
    vi.advanceTimersByTime(35_000);

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      source: string;
      eventType: string;
      metadata: Record<string, unknown>;
    }[];
    expect(body[0]!.source).toBe("spike-app");
    expect(body[0]!.eventType).toBe("custom_test");
    expect(body[0]!.metadata.key1).toBe("val1");
    expect(body[0]!.metadata.key2).toBe(42);
  });

  // ── sendBeacon on hidden page ─────────────────────────────────────────────

  it("uses sendBeacon when document.visibilityState is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });

    const { useAnalytics } = await freshModule();
    const analytics = useAnalytics();

    analytics.trackEvent("beacon_test", { page: "/test" });
    vi.advanceTimersByTime(35_000);

    expect(mockSendBeacon).toHaveBeenCalledWith("/analytics/ingest", expect.any(Blob));
  });

  // ── 429 back-off ──────────────────────────────────────────────────────────

  it("handles 429 response without throwing", async () => {
    mockFetch.mockResolvedValue({ status: 429 } as Response);

    const { useAnalytics } = await freshModule();
    const analytics = useAnalytics();

    analytics.trackEvent("test", {});
    // Should not throw when the 429 fetch resolves
    await expect(vi.advanceTimersByTimeAsync(35_000)).resolves.not.toThrow();
  });

  // ── Queue drains after flush ──────────────────────────────────────────────

  it("does not re-flush an already-flushed empty queue", async () => {
    const { useAnalytics } = await freshModule();
    const analytics = useAnalytics();

    analytics.trackEvent("event1", {});
    vi.advanceTimersByTime(35_000);
    const callCount = mockFetch.mock.calls.length;

    // Advance again with no new events — no additional fetch expected
    vi.advanceTimersByTime(35_000);
    expect(mockFetch.mock.calls.length).toBe(callCount);
  });

  // ── Route change page_view ────────────────────────────────────────────────

  it("auto-tracks page_view on route change via router.subscribe", async () => {
    const { useAnalytics } = await freshModule();
    useAnalytics();

    expect(mockSubscribe).toHaveBeenCalledWith("onResolved", expect.any(Function));

    // Drain initial page_view
    vi.advanceTimersByTime(35_000);
    mockFetch.mockClear();

    // Simulate navigation to a new path
    const onResolved = mockSubscribe.mock.calls[0]![1] as (arg: {
      toLocation: { pathname: string };
    }) => void;
    onResolved({ toLocation: { pathname: "/dashboard" } });
    vi.advanceTimersByTime(35_000);

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      eventType: string;
      metadata: { path: string };
    }[];
    expect(body[0]!.eventType).toBe("page_view");
    expect(body[0]!.metadata.path).toBe("/dashboard");
  });

  it("deduplicates consecutive page_view events for the same path", async () => {
    const { trackAnalyticsPageView, flushAnalyticsQueue } = await freshModule();

    localStorage.setItem("cookie_consent", "accepted");

    // Enqueue the same path twice
    trackAnalyticsPageView("/same-path");
    trackAnalyticsPageView("/same-path");
    flushAnalyticsQueue();

    vi.advanceTimersByTime(35_000);

    if (mockFetch.mock.calls.length > 0) {
      const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
        metadata: { path: string };
      }[];
      const pageViews = body.filter((e) => (e as { eventType?: string }).eventType === "page_view");
      // Only one page_view for /same-path should exist
      const samePathViews = pageViews.filter((e) => e.metadata.path === "/same-path");
      expect(samePathViews.length).toBeLessThanOrEqual(1);
    }
  });

  // ── Consent gate ─────────────────────────────────────────────────────────

  it("drops events when cookie_consent is not accepted", async () => {
    localStorage.removeItem("cookie_consent");

    const { trackAnalyticsEvent } = await freshModule();
    trackAnalyticsEvent("should_be_dropped", {});

    vi.advanceTimersByTime(35_000);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("flushAnalyticsQueue sends buffered events immediately", async () => {
    const { trackAnalyticsEvent, flushAnalyticsQueue } = await freshModule();

    trackAnalyticsEvent("urgent_event", { priority: "high" });
    flushAnalyticsQueue();

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      eventType: string;
    }[];
    expect(body[0]!.eventType).toBe("urgent_event");
  });

  // ── Queue overflow flush ──────────────────────────────────────────────────

  it("flushes immediately when queue reaches MAX_QUEUE_SIZE (20)", async () => {
    const { trackAnalyticsEvent } = await freshModule();

    for (let i = 0; i < 20; i++) {
      trackAnalyticsEvent("overflow_event", { index: i });
    }

    // Flush should happen synchronously without waiting for timer
    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as unknown[];
    expect(body.length).toBe(20);
  });

  // ── trackPageView helper ──────────────────────────────────────────────────

  it("trackPageView enqueues a page_view event with sessionDuration", async () => {
    const { trackAnalyticsPageView } = await freshModule();

    trackAnalyticsPageView("/pricing", 5000);
    vi.advanceTimersByTime(35_000);

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      eventType: string;
      metadata: { path: string; sessionDuration: number };
    }[];
    const ev = body.find((e) => e.eventType === "page_view");
    expect(ev).toBeDefined();
    expect(ev!.metadata.path).toBe("/pricing");
    expect(ev!.metadata.sessionDuration).toBe(5000);
  });

  // ── trackToolInvocation ───────────────────────────────────────────────────

  it("trackToolInvocation enqueues a tool_use event", async () => {
    const { trackAnalyticsToolInvocation } = await freshModule();

    trackAnalyticsToolInvocation("esbuild_compile", 123);
    vi.advanceTimersByTime(35_000);

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body) as {
      eventType: string;
      metadata: { toolName: string; durationMs: number };
    }[];
    const ev = body.find((e) => e.eventType === "tool_use");
    expect(ev).toBeDefined();
    expect(ev!.metadata.toolName).toBe("esbuild_compile");
    expect(ev!.metadata.durationMs).toBe(123);
  });
});
