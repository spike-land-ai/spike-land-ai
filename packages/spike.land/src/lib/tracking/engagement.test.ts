import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEngagementCollector, flushEngagement } from "./engagement";

describe("createEngagementCollector", () => {
  it("should initialize with correct defaults", () => {
    const collector = createEngagementCollector("v-1", "/home");
    expect(collector.data).toEqual({
      visitorId: "v-1",
      page: "/home",
      abVariant: undefined,
      scrollDepthMax: 0,
      timeOnPageMs: 0,
      sectionsViewed: [],
      chatOpened: false,
      ctaClicked: undefined,
      faqExpanded: 0,
    });
  });

  it("should initialize with abVariant when provided", () => {
    const collector = createEngagementCollector("v-1", "/home", "variant-a");
    expect(collector.data.abVariant).toBe("variant-a");
  });

  describe("updateScrollDepth", () => {
    it("should update when new depth is higher", () => {
      const collector = createEngagementCollector("v-1", "/");
      expect(collector.updateScrollDepth(50)).toBe(true);
      expect(collector.data.scrollDepthMax).toBe(50);
    });

    it("should not decrease scroll depth", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.updateScrollDepth(80);
      expect(collector.updateScrollDepth(30)).toBe(false);
      expect(collector.data.scrollDepthMax).toBe(80);
    });

    it("should not update for equal depth", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.updateScrollDepth(50);
      expect(collector.updateScrollDepth(50)).toBe(false);
    });
  });

  describe("addSection", () => {
    it("should add a new section", () => {
      const collector = createEngagementCollector("v-1", "/");
      expect(collector.addSection("hero")).toBe(true);
      expect(collector.data.sectionsViewed).toEqual(["hero"]);
    });

    it("should deduplicate sections", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.addSection("hero");
      expect(collector.addSection("hero")).toBe(false);
      expect(collector.data.sectionsViewed).toEqual(["hero"]);
    });

    it("should add multiple unique sections", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.addSection("hero");
      collector.addSection("features");
      collector.addSection("pricing");
      expect(collector.data.sectionsViewed).toEqual(["hero", "features", "pricing"]);
    });
  });

  describe("updateTimeOnPage", () => {
    it("should calculate time difference from start", () => {
      const collector = createEngagementCollector("v-1", "/");
      const startTime = Date.now() - 5000;
      collector.updateTimeOnPage(startTime);
      expect(collector.data.timeOnPageMs).toBeGreaterThanOrEqual(4900);
      expect(collector.data.timeOnPageMs).toBeLessThanOrEqual(6000);
    });
  });

  describe("handleEvent", () => {
    it("should handle chatOpened event", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.handleEvent("chatOpened");
      expect(collector.data.chatOpened).toBe(true);
    });

    it("should handle ctaClicked event", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.handleEvent("ctaClicked", "signup-btn");
      expect(collector.data.ctaClicked).toBe("signup-btn");
    });

    it("should handle faqExpanded event", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.handleEvent("faqExpanded");
      collector.handleEvent("faqExpanded");
      expect(collector.data.faqExpanded).toBe(2);
    });

    it("should ignore unknown event types", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.handleEvent("unknownEvent");
      expect(collector.data.chatOpened).toBe(false);
      expect(collector.data.ctaClicked).toBeUndefined();
      expect(collector.data.faqExpanded).toBe(0);
    });
  });

  describe("isDirty / markClean", () => {
    it("should start clean", () => {
      const collector = createEngagementCollector("v-1", "/");
      expect(collector.isDirty()).toBe(false);
    });

    it("should become dirty after scroll update", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.updateScrollDepth(10);
      expect(collector.isDirty()).toBe(true);
    });

    it("should become dirty after addSection", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.addSection("hero");
      expect(collector.isDirty()).toBe(true);
    });

    it("should become dirty after handleEvent", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.handleEvent("chatOpened");
      expect(collector.isDirty()).toBe(true);
    });

    it("should reset dirty flag with markClean", () => {
      const collector = createEngagementCollector("v-1", "/");
      collector.updateScrollDepth(10);
      expect(collector.isDirty()).toBe(true);
      collector.markClean();
      expect(collector.isDirty()).toBe(false);
    });
  });
});

describe("flushEngagement", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should call navigator.sendBeacon with correct URL and data", () => {
    const mockSendBeacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { sendBeacon: mockSendBeacon });

    const data = {
      visitorId: "v-1",
      page: "/home",
      scrollDepthMax: 75,
      timeOnPageMs: 10000,
      sectionsViewed: ["hero"],
      chatOpened: false,
      faqExpanded: 0,
    };

    flushEngagement(data);

    expect(mockSendBeacon).toHaveBeenCalledTimes(1);
    expect(mockSendBeacon).toHaveBeenCalledWith("/api/bazdmeg/engagement", expect.anything());

    // Verify blob content
    const blob = mockSendBeacon.mock.calls[0]![1] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/json");

    vi.unstubAllGlobals();
  });

  it("should not throw if navigator.sendBeacon is unavailable", () => {
    vi.stubGlobal("navigator", {});
    const data = {
      visitorId: "v-1",
      page: "/",
      scrollDepthMax: 0,
      timeOnPageMs: 0,
      sectionsViewed: [],
      chatOpened: false,
      faqExpanded: 0,
    };

    expect(() => flushEngagement(data)).not.toThrow();
    vi.unstubAllGlobals();
  });
});
