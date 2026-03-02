import { describe, expect, it, vi } from "vitest";

import type { VisitorSession } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {},
}));

const {
  calculateDaysDifference,
  calculatePositionBasedAttribution,
  calculateTimeDecayAttribution,
  determineSessionPlatform,
  extractUTMFromSession,
  safeParseUrlHostname,
} = await import("./attribution-helpers");

function makeSession(overrides: Partial<VisitorSession> = {}): VisitorSession {
  return {
    id: "sess-1",
    userId: "user-1",
    sessionStart: new Date("2025-01-01"),
    sessionEnd: null,
    referrer: null,
    landingPage: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    gclid: null,
    fbclid: null,
    country: null,
    device: null,
    browser: null,
    events: 0,
    pageViews: 0,
    conversionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as VisitorSession;
}

describe("calculateDaysDifference", () => {
  it("calculates 0 for same date", () => {
    const d = new Date("2025-01-01");
    expect(calculateDaysDifference(d, d)).toBe(0);
  });

  it("calculates 1 for next day", () => {
    const a = new Date("2025-01-01");
    const b = new Date("2025-01-02");
    expect(calculateDaysDifference(a, b)).toBeCloseTo(1, 1);
  });

  it("calculates 7 for a week", () => {
    const a = new Date("2025-01-01");
    const b = new Date("2025-01-08");
    expect(calculateDaysDifference(a, b)).toBeCloseTo(7, 1);
  });

  it("returns negative for reversed dates", () => {
    const a = new Date("2025-01-02");
    const b = new Date("2025-01-01");
    expect(calculateDaysDifference(a, b)).toBeLessThan(0);
  });
});

describe("calculatePositionBasedAttribution", () => {
  it("returns empty for no sessions", () => {
    expect(calculatePositionBasedAttribution([])).toEqual([]);
  });

  it("returns [1.0] for single session", () => {
    expect(calculatePositionBasedAttribution([makeSession()])).toEqual([1.0]);
  });

  it("returns [0.5, 0.5] for two sessions", () => {
    expect(calculatePositionBasedAttribution([makeSession(), makeSession()])).toEqual([0.5, 0.5]);
  });

  it("distributes 40/20/40 for three sessions", () => {
    const weights = calculatePositionBasedAttribution([
      makeSession(),
      makeSession(),
      makeSession(),
    ]);
    expect(weights[0]).toBeCloseTo(0.4, 5);
    expect(weights[1]).toBeCloseTo(0.2, 5);
    expect(weights[2]).toBeCloseTo(0.4, 5);
  });

  it("distributes middle weight equally for many sessions", () => {
    const sessions = Array.from({ length: 5 }, () => makeSession());
    const weights = calculatePositionBasedAttribution(sessions);
    expect(weights[0]).toBeCloseTo(0.4, 5);
    expect(weights[4]).toBeCloseTo(0.4, 5);
    // Middle 3 sessions share 0.2 equally
    expect(weights[1]).toBeCloseTo(0.2 / 3, 5);
    expect(weights[2]).toBeCloseTo(0.2 / 3, 5);
    expect(weights[3]).toBeCloseTo(0.2 / 3, 5);
  });

  it("weights sum to approximately 1", () => {
    const sessions = Array.from({ length: 10 }, () => makeSession());
    const weights = calculatePositionBasedAttribution(sessions);
    const total = weights.reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("calculateTimeDecayAttribution", () => {
  it("returns empty for no sessions", () => {
    expect(calculateTimeDecayAttribution([], new Date())).toEqual([]);
  });

  it("returns [1] for single session", () => {
    const session = makeSession({
      sessionStart: new Date("2025-01-01"),
    });
    const weights = calculateTimeDecayAttribution([session], new Date("2025-01-01"));
    expect(weights).toHaveLength(1);
    expect(weights[0]).toBeCloseTo(1, 5);
  });

  it("gives more weight to recent sessions", () => {
    const recent = makeSession({
      sessionStart: new Date("2025-01-07"),
    });
    const old = makeSession({
      sessionStart: new Date("2025-01-01"),
    });
    const weights = calculateTimeDecayAttribution([old, recent], new Date("2025-01-08"));
    expect(weights[1]!).toBeGreaterThan(weights[0]!);
  });

  it("weights sum to approximately 1", () => {
    const sessions = Array.from({ length: 5 }, (_, i) =>
      makeSession({
        sessionStart: new Date(2025, 0, i + 1),
      }),
    );
    const weights = calculateTimeDecayAttribution(sessions, new Date(2025, 0, 10));
    const total = weights.reduce((s, w) => s + w, 0);
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("safeParseUrlHostname", () => {
  it("parses valid URL", async () => {
    expect(await safeParseUrlHostname("https://google.com/search")).toBe("google.com");
  });

  it("returns null for invalid URL", async () => {
    expect(await safeParseUrlHostname("not-a-url")).toBeNull();
  });

  it("lowercases hostname", async () => {
    expect(await safeParseUrlHostname("https://GOOGLE.COM")).toBe("google.com");
  });
});

describe("determineSessionPlatform", () => {
  it("returns GOOGLE_ADS for gclid", async () => {
    expect(await determineSessionPlatform(makeSession({ gclid: "abc123" }))).toBe("GOOGLE_ADS");
  });

  it("returns FACEBOOK for fbclid", async () => {
    expect(await determineSessionPlatform(makeSession({ fbclid: "abc123" }))).toBe("FACEBOOK");
  });

  it("returns GOOGLE_ADS for google utm_source", async () => {
    expect(await determineSessionPlatform(makeSession({ utmSource: "google" }))).toBe("GOOGLE_ADS");
  });

  it("returns FACEBOOK for facebook utm_source", async () => {
    expect(await determineSessionPlatform(makeSession({ utmSource: "facebook" }))).toBe("FACEBOOK");
  });

  it("returns FACEBOOK for instagram utm_source", async () => {
    expect(await determineSessionPlatform(makeSession({ utmSource: "instagram" }))).toBe(
      "FACEBOOK",
    );
  });

  it("returns OTHER for unknown utm_source", async () => {
    expect(await determineSessionPlatform(makeSession({ utmSource: "twitter" }))).toBe("OTHER");
  });

  it("returns ORGANIC for google.com referrer", async () => {
    expect(
      await determineSessionPlatform(
        makeSession({ referrer: "https://www.google.com/search?q=test" }),
      ),
    ).toBe("ORGANIC");
  });

  it("returns ORGANIC for bing.com referrer", async () => {
    expect(
      await determineSessionPlatform(
        makeSession({ referrer: "https://www.bing.com/search?q=test" }),
      ),
    ).toBe("ORGANIC");
  });

  it("returns OTHER for unknown referrer", async () => {
    expect(await determineSessionPlatform(makeSession({ referrer: "https://example.com" }))).toBe(
      "OTHER",
    );
  });

  it("returns DIRECT for no tracking info", async () => {
    expect(await determineSessionPlatform(makeSession())).toBe("DIRECT");
  });
});

describe("extractUTMFromSession", () => {
  it("extracts all UTM fields", () => {
    const session = makeSession({
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "summer",
      utmTerm: "shoes",
      utmContent: "ad1",
      gclid: "gclid123",
      fbclid: "fbclid456",
    });
    const result = extractUTMFromSession(session);
    expect(result).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "summer",
      utm_term: "shoes",
      utm_content: "ad1",
      gclid: "gclid123",
      fbclid: "fbclid456",
    });
  });

  it("returns undefined for null fields", () => {
    const result = extractUTMFromSession(makeSession());
    expect(result.utm_source).toBeUndefined();
    expect(result.gclid).toBeUndefined();
  });
});
