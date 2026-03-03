/**
 * Engagement data collection utilities.
 *
 * Pure functions extracted from EngagementTracker component
 * for testability and reuse.
 */

export interface EngagementData {
  visitorId: string;
  page: string;
  abVariant?: string;
  scrollDepthMax: number;
  timeOnPageMs: number;
  sectionsViewed: string[];
  chatOpened: boolean;
  ctaClicked?: string;
  faqExpanded: number;
}

export function createEngagementCollector(
  visitorId: string,
  page: string,
  abVariant?: string,
): {
  data: EngagementData;
  updateScrollDepth: (depth: number) => boolean;
  addSection: (sectionId: string) => boolean;
  updateTimeOnPage: (startTime: number) => void;
  handleEvent: (type: string, value?: string) => void;
  isDirty: () => boolean;
  markClean: () => void;
} {
  let dirty = false;

  const data: EngagementData = {
    visitorId,
    page,
    abVariant,
    scrollDepthMax: 0,
    timeOnPageMs: 0,
    sectionsViewed: [],
    chatOpened: false,
    ctaClicked: undefined,
    faqExpanded: 0,
  };

  return {
    data,

    updateScrollDepth(depth: number): boolean {
      if (depth > data.scrollDepthMax) {
        data.scrollDepthMax = depth;
        dirty = true;
        return true;
      }
      return false;
    },

    addSection(sectionId: string): boolean {
      if (!data.sectionsViewed.includes(sectionId)) {
        data.sectionsViewed.push(sectionId);
        dirty = true;
        return true;
      }
      return false;
    },

    updateTimeOnPage(startTime: number): void {
      data.timeOnPageMs = Date.now() - startTime;
      dirty = true;
    },

    handleEvent(type: string, value?: string): void {
      if (type === "chatOpened") {
        data.chatOpened = true;
        dirty = true;
      } else if (type === "ctaClicked") {
        data.ctaClicked = value;
        dirty = true;
      } else if (type === "faqExpanded") {
        data.faqExpanded++;
        dirty = true;
      }
    },

    isDirty(): boolean {
      return dirty;
    },

    markClean(): void {
      dirty = false;
    },
  };
}

/** Flush engagement data via sendBeacon. */
export function flushEngagement(
  data: Omit<EngagementData, "abVariant"> & { abVariant?: string; },
): void {
  if (
    typeof navigator === "undefined"
    || typeof navigator.sendBeacon !== "function"
  ) {
    return;
  }
  navigator.sendBeacon(
    "/api/bazdmeg/engagement",
    new Blob([JSON.stringify(data)], { type: "application/json" }),
  );
}
