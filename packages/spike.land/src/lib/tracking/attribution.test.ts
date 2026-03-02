import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignAttribution } from "@prisma/client";

// --- Prisma mock setup ---
const mockCampaignAttributionCreate = vi.fn();
const mockCampaignAttributionFindFirst = vi.fn();
const mockCampaignAttributionFindMany = vi.fn();
const mockCampaignAttributionCount = vi.fn();
const mockCampaignAttributionCreateMany = vi.fn();
const mockCampaignAttributionGroupBy = vi.fn();
const mockVisitorSessionFindMany = vi.fn();
const mockVisitorSessionCreate = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    campaignAttribution: {
      create: (...args: unknown[]) => mockCampaignAttributionCreate(...args),
      findFirst: (...args: unknown[]) => mockCampaignAttributionFindFirst(...args),
      findMany: (...args: unknown[]) => mockCampaignAttributionFindMany(...args),
      count: (...args: unknown[]) => mockCampaignAttributionCount(...args),
      createMany: (...args: unknown[]) => mockCampaignAttributionCreateMany(...args),
      groupBy: (...args: unknown[]) => mockCampaignAttributionGroupBy(...args),
    },
    visitorSession: {
      findMany: (...args: unknown[]) => mockVisitorSessionFindMany(...args),
      create: (...args: unknown[]) => mockVisitorSessionCreate(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    campaignLink: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock("./utm-capture", () => ({
  getPlatformFromUTM: (params: Record<string, string>) => {
    if (params.utm_source?.includes("google")) return "GOOGLE_ADS";
    if (params.utm_source?.includes("facebook")) return "FACEBOOK";
    return "OTHER";
  },
}));

vi.mock("./attribution-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./attribution-helpers")>();
  return {
    ...actual,
    determineSessionPlatform: vi.fn().mockResolvedValue("DIRECT"),
    getExternalCampaignId: vi.fn().mockResolvedValue(null),
    extractUTMFromSession: vi.fn().mockReturnValue({}),
  };
});

const {
  createAttribution,
  getFirstTouchAttribution,
  getLastTouchAttribution,
  getAllAttributions,
  attributeConversion,
  getCampaignAttributionSummary,
  hasExistingAttribution,
  getGlobalAttributionSummary,
} = await import("./attribution");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "session-1",
    visitorId: "visitor-1",
    userId: "user-1",
    landingPage: "/",
    referrer: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    utmTerm: null,
    utmContent: null,
    gclid: null,
    fbclid: null,
    pageViewCount: 1,
    sessionStart: new Date("2025-01-01T10:00:00Z"),
    sessionEnd: null,
    ...overrides,
  };
}

function makeAttribution(overrides: Partial<CampaignAttribution> = {}): CampaignAttribution {
  return {
    id: "attr-1",
    userId: "user-1",
    sessionId: "session-1",
    conversionId: "conv-1",
    attributionType: "FIRST_TOUCH",
    conversionType: "SIGNUP",
    conversionValue: null,
    platform: "DIRECT",
    externalCampaignId: null,
    utmCampaign: null,
    utmSource: null,
    utmMedium: null,
    convertedAt: new Date("2025-01-10T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createAttribution
// ---------------------------------------------------------------------------
describe("createAttribution", () => {
  it("creates attribution record with provided params", async () => {
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr-new" });

    await createAttribution({
      userId: "user-1",
      sessionId: "session-1",
      conversionId: "conv-1",
      attributionType: "FIRST_TOUCH",
      conversionType: "SIGNUP",
      conversionValue: 100,
      platform: "GOOGLE_ADS",
      utmParams: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "summer-sale",
      },
    });

    expect(mockCampaignAttributionCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        sessionId: "session-1",
        conversionId: "conv-1",
        attributionType: "FIRST_TOUCH",
        conversionType: "SIGNUP",
        conversionValue: 100,
        platform: "GOOGLE_ADS",
        utmCampaign: "summer-sale",
        utmSource: "google",
        utmMedium: "cpc",
      }),
    });
  });

  it("derives platform from UTM params when platform not provided", async () => {
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr-new" });

    await createAttribution({
      userId: "user-1",
      sessionId: "session-1",
      conversionId: "conv-1",
      attributionType: "LAST_TOUCH",
      conversionType: "PURCHASE",
      utmParams: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "winter-sale",
      },
    });

    const callArg = mockCampaignAttributionCreate.mock.calls[0]![0] as {
      data: { platform: string };
    };
    expect(callArg.data.platform).toBe("GOOGLE_ADS");
  });

  it("uses DIRECT as default platform when no UTM or platform provided", async () => {
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr-new" });

    await createAttribution({
      userId: "user-1",
      sessionId: "session-1",
      conversionId: "conv-1",
      attributionType: "LINEAR",
      conversionType: "SIGNUP",
    });

    const callArg = mockCampaignAttributionCreate.mock.calls[0]![0] as {
      data: { platform: string };
    };
    expect(callArg.data.platform).toBe("DIRECT");
  });

  it("creates attribution without optional fields", async () => {
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr-minimal" });

    await createAttribution({
      userId: "user-2",
      sessionId: "session-2",
      conversionId: "conv-2",
      attributionType: "POSITION_BASED",
      conversionType: "ENHANCEMENT",
    });

    const callArg = mockCampaignAttributionCreate.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(callArg.data.externalCampaignId).toBeUndefined();
    expect(callArg.data.conversionValue).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getFirstTouchAttribution
// ---------------------------------------------------------------------------
describe("getFirstTouchAttribution", () => {
  it("returns first-touch attribution when found", async () => {
    const attr = makeAttribution({ attributionType: "FIRST_TOUCH" });
    mockCampaignAttributionFindFirst.mockResolvedValue(attr);

    const result = await getFirstTouchAttribution("user-1");

    expect(mockCampaignAttributionFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", attributionType: "FIRST_TOUCH" },
      orderBy: { convertedAt: "asc" },
    });
    expect(result).toEqual(attr);
  });

  it("returns null when no first-touch attribution exists", async () => {
    mockCampaignAttributionFindFirst.mockResolvedValue(null);

    const result = await getFirstTouchAttribution("user-no-attr");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLastTouchAttribution
// ---------------------------------------------------------------------------
describe("getLastTouchAttribution", () => {
  it("returns last-touch attribution ordered by convertedAt desc", async () => {
    const attr = makeAttribution({ attributionType: "LAST_TOUCH" });
    mockCampaignAttributionFindFirst.mockResolvedValue(attr);

    const result = await getLastTouchAttribution("user-1");

    expect(mockCampaignAttributionFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", attributionType: "LAST_TOUCH" },
      orderBy: { convertedAt: "desc" },
    });
    expect(result!.attributionType).toBe("LAST_TOUCH");
  });

  it("returns null when no last-touch attribution exists", async () => {
    mockCampaignAttributionFindFirst.mockResolvedValue(null);

    const result = await getLastTouchAttribution("user-new");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAllAttributions
// ---------------------------------------------------------------------------
describe("getAllAttributions", () => {
  it("returns all attributions for a user ordered by convertedAt desc", async () => {
    const attrs = [
      makeAttribution({ id: "attr-1", attributionType: "FIRST_TOUCH" }),
      makeAttribution({ id: "attr-2", attributionType: "LAST_TOUCH" }),
      makeAttribution({ id: "attr-3", attributionType: "LINEAR" }),
    ];
    mockCampaignAttributionFindMany.mockResolvedValue(attrs);

    const result = await getAllAttributions("user-1");

    expect(mockCampaignAttributionFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { convertedAt: "desc" },
    });
    expect(result).toHaveLength(3);
  });

  it("returns empty array when user has no attributions", async () => {
    mockCampaignAttributionFindMany.mockResolvedValue([]);

    const result = await getAllAttributions("user-no-history");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// hasExistingAttribution
// ---------------------------------------------------------------------------
describe("hasExistingAttribution", () => {
  it("returns true when count > 0", async () => {
    mockCampaignAttributionCount.mockResolvedValue(3);

    const result = await hasExistingAttribution("user-1", "SIGNUP");

    expect(result).toBe(true);
    expect(mockCampaignAttributionCount).toHaveBeenCalledWith({
      where: { userId: "user-1", conversionType: "SIGNUP" },
    });
  });

  it("returns false when count is 0", async () => {
    mockCampaignAttributionCount.mockResolvedValue(0);

    const result = await hasExistingAttribution("user-1", "PURCHASE");

    expect(result).toBe(false);
  });

  it("checks all conversion types correctly", async () => {
    mockCampaignAttributionCount.mockResolvedValue(1);

    for (const convType of ["SIGNUP", "ENHANCEMENT", "PURCHASE"] as const) {
      await hasExistingAttribution("user-1", convType);
    }

    expect(mockCampaignAttributionCount).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// attributeConversion — multi-session path
// ---------------------------------------------------------------------------
describe("attributeConversion", () => {
  it("creates FIRST_TOUCH, LAST_TOUCH, LINEAR, TIME_DECAY, POSITION_BASED for single session", async () => {
    const session = makeSession();
    mockVisitorSessionFindMany.mockResolvedValue([session]);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "SIGNUP", 50);

    // Should have called create 5 times (5 attribution models)
    expect(mockCampaignAttributionCreate).toHaveBeenCalledTimes(5);

    const types = mockCampaignAttributionCreate.mock.calls.map(
      (call) => (call[0] as { data: { attributionType: string } }).data.attributionType,
    );
    expect(types).toContain("FIRST_TOUCH");
    expect(types).toContain("LAST_TOUCH");
    expect(types).toContain("LINEAR");
    expect(types).toContain("TIME_DECAY");
    expect(types).toContain("POSITION_BASED");
  });

  it("uses same conversionId across all attribution records", async () => {
    const session = makeSession();
    mockVisitorSessionFindMany.mockResolvedValue([session]);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "PURCHASE", 100);

    const conversionIds = mockCampaignAttributionCreate.mock.calls.map(
      (call) => (call[0] as { data: { conversionId: string } }).data.conversionId,
    );
    const uniqueIds = new Set(conversionIds);
    // All 5 models share the same conversionId
    expect(uniqueIds.size).toBe(1);
    // conversionId is a valid UUID string
    expect(conversionIds[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("distributes linear value equally across sessions", async () => {
    const sessions = [
      makeSession({ id: "s-1" }),
      makeSession({ id: "s-2" }),
      makeSession({ id: "s-3" }),
    ];
    mockVisitorSessionFindMany.mockResolvedValue(sessions);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "ENHANCEMENT", 300);

    const linearCalls = mockCampaignAttributionCreate.mock.calls.filter(
      (call) =>
        (call[0] as { data: { attributionType: string } }).data.attributionType === "LINEAR",
    );
    expect(linearCalls).toHaveLength(3);
    for (const call of linearCalls) {
      const value = (call[0] as { data: { conversionValue: number } }).data.conversionValue;
      expect(value).toBeCloseTo(100, 5); // 300 / 3 = 100
    }
  });

  it("creates attribution for 3 sessions: first and last get more weight in POSITION_BASED", async () => {
    const sessions = [
      makeSession({ id: "s-1", sessionStart: new Date("2025-01-01") }),
      makeSession({ id: "s-2", sessionStart: new Date("2025-01-05") }),
      makeSession({ id: "s-3", sessionStart: new Date("2025-01-09") }),
    ];
    mockVisitorSessionFindMany.mockResolvedValue(sessions);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "SIGNUP", 100);

    const positionCalls = mockCampaignAttributionCreate.mock.calls.filter(
      (call) =>
        (call[0] as { data: { attributionType: string } }).data.attributionType ===
        "POSITION_BASED",
    );
    expect(positionCalls).toHaveLength(3);

    const values = positionCalls.map(
      (call) => (call[0] as { data: { conversionValue: number } }).data.conversionValue,
    );
    // First (40%) and last (40%) should have equal value, middle (20%) less
    expect(values[0]).toBeCloseTo(40, 5); // 40% of 100
    expect(values[1]).toBeCloseTo(20, 5); // 20% of 100 (middle)
    expect(values[2]).toBeCloseTo(40, 5); // 40% of 100
  });

  it("falls back to direct attribution when user has no sessions but exists in DB", async () => {
    mockVisitorSessionFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({ id: "user-direct" });
    mockVisitorSessionCreate.mockResolvedValue(makeSession({ id: "direct-session" }));
    mockCampaignAttributionCreateMany.mockResolvedValue({ count: 5 });

    await attributeConversion("user-direct", "SIGNUP");

    expect(mockVisitorSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId: "direct_user-direct",
          userId: "user-direct",
          landingPage: "/",
          pageViewCount: 0,
        }),
      }),
    );
    expect(mockCampaignAttributionCreateMany).toHaveBeenCalled();
  });

  it("does nothing when user not found and has no sessions", async () => {
    mockVisitorSessionFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue(null);

    await attributeConversion("ghost-user", "PURCHASE");

    expect(mockCampaignAttributionCreate).not.toHaveBeenCalled();
    expect(mockCampaignAttributionCreateMany).not.toHaveBeenCalled();
  });

  it("creates attribution without value when value is undefined", async () => {
    const session = makeSession();
    mockVisitorSessionFindMany.mockResolvedValue([session]);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "SIGNUP"); // no value

    const allCalls = mockCampaignAttributionCreate.mock.calls;
    expect(allCalls.length).toBeGreaterThan(0);
    // All created with undefined value
    for (const call of allCalls) {
      const data = (call[0] as { data: { conversionValue: unknown } }).data;
      expect(data.conversionValue).toBeUndefined();
    }
  });

  it("handles two sessions: FIRST_TOUCH uses first session, LAST_TOUCH uses last", async () => {
    const sessions = [
      makeSession({ id: "s-first", sessionStart: new Date("2025-01-01") }),
      makeSession({ id: "s-last", sessionStart: new Date("2025-01-10") }),
    ];
    mockVisitorSessionFindMany.mockResolvedValue(sessions);
    mockCampaignAttributionCreate.mockResolvedValue({ id: "attr" });

    await attributeConversion("user-1", "ENHANCEMENT");

    const firstTouchCall = mockCampaignAttributionCreate.mock.calls.find(
      (call) =>
        (call[0] as { data: { attributionType: string } }).data.attributionType === "FIRST_TOUCH",
    );
    const lastTouchCall = mockCampaignAttributionCreate.mock.calls.find(
      (call) =>
        (call[0] as { data: { attributionType: string } }).data.attributionType === "LAST_TOUCH",
    );

    expect((firstTouchCall![0] as { data: { sessionId: string } }).data.sessionId).toBe("s-first");
    expect((lastTouchCall![0] as { data: { sessionId: string } }).data.sessionId).toBe("s-last");
  });
});

// ---------------------------------------------------------------------------
// getCampaignAttributionSummary
// ---------------------------------------------------------------------------
describe("getCampaignAttributionSummary", () => {
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-01-31");

  it("returns zero summary when no attributions found", async () => {
    mockCampaignAttributionFindMany.mockResolvedValue([]);

    const result = await getCampaignAttributionSummary("summer-sale", startDate, endDate);

    expect(result.totalConversions).toBe(0);
    expect(result.firstTouchValue).toBe(0);
    expect(result.lastTouchValue).toBe(0);
    expect(result.linearValue).toBe(0);
  });

  it("calculates correct totals for a single conversion with all models", async () => {
    const convId = "conv-abc";
    const attributions = [
      makeAttribution({
        conversionId: convId,
        attributionType: "FIRST_TOUCH",
        conversionValue: 100,
        conversionType: "PURCHASE",
        utmCampaign: "summer-sale",
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "LAST_TOUCH",
        conversionValue: 100,
        conversionType: "PURCHASE",
        utmCampaign: "summer-sale",
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "LINEAR",
        conversionValue: 50,
        conversionType: "PURCHASE",
        utmCampaign: "summer-sale",
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "TIME_DECAY",
        conversionValue: 60,
        conversionType: "PURCHASE",
        utmCampaign: "summer-sale",
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "POSITION_BASED",
        conversionValue: 70,
        conversionType: "PURCHASE",
        utmCampaign: "summer-sale",
      }),
    ];
    mockCampaignAttributionFindMany.mockResolvedValue(attributions);

    const result = await getCampaignAttributionSummary("summer-sale", startDate, endDate);

    expect(result.totalConversions).toBe(1);
    expect(result.firstTouchValue).toBe(100);
    expect(result.lastTouchValue).toBe(100);
    expect(result.linearValue).toBe(50);
  });

  it("counts conversions by type correctly", async () => {
    const attributions = [
      makeAttribution({
        conversionId: "conv-1",
        attributionType: "FIRST_TOUCH",
        conversionType: "SIGNUP",
        conversionValue: null,
      }),
      makeAttribution({
        conversionId: "conv-2",
        attributionType: "FIRST_TOUCH",
        conversionType: "PURCHASE",
        conversionValue: 200,
      }),
    ];
    mockCampaignAttributionFindMany.mockResolvedValue(attributions);

    const result = await getCampaignAttributionSummary("campaign-x", startDate, endDate);

    expect(result.totalConversions).toBe(2);
    expect(result.conversionsByType.SIGNUP).toBe(1);
    expect(result.conversionsByType.PURCHASE).toBe(1);
    expect(result.conversionsByType.ENHANCEMENT).toBe(0);
  });

  it("handles null conversionValue as 0 in totals", async () => {
    const attributions = [
      makeAttribution({
        conversionId: "conv-null",
        attributionType: "FIRST_TOUCH",
        conversionValue: null,
      }),
    ];
    mockCampaignAttributionFindMany.mockResolvedValue(attributions);

    const result = await getCampaignAttributionSummary("free-campaign", startDate, endDate);

    expect(result.firstTouchValue).toBe(0);
    expect(result.lastTouchValue).toBe(0);
    expect(result.linearValue).toBe(0);
  });

  it("queries with correct date range and campaign name", async () => {
    mockCampaignAttributionFindMany.mockResolvedValue([]);

    await getCampaignAttributionSummary("test-campaign", startDate, endDate);

    expect(mockCampaignAttributionFindMany).toHaveBeenCalledWith({
      where: {
        utmCampaign: "test-campaign",
        convertedAt: { gte: startDate, lte: endDate },
      },
    });
  });

  it("aggregates linear values across multiple LINEAR records per conversion", async () => {
    const convId = "conv-multi-linear";
    const attributions = [
      makeAttribution({
        conversionId: convId,
        attributionType: "LINEAR",
        conversionValue: 33.33,
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "LINEAR",
        conversionValue: 33.33,
      }),
      makeAttribution({
        conversionId: convId,
        attributionType: "LINEAR",
        conversionValue: 33.34,
      }),
    ];
    mockCampaignAttributionFindMany.mockResolvedValue(attributions);

    const result = await getCampaignAttributionSummary("any-campaign", startDate, endDate);

    expect(result.linearValue).toBeCloseTo(100, 1);
  });
});

// ---------------------------------------------------------------------------
// getGlobalAttributionSummary
// ---------------------------------------------------------------------------
describe("getGlobalAttributionSummary", () => {
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-12-31");

  it("returns structured summary with comparison and platform breakdown", async () => {
    mockCampaignAttributionCount.mockResolvedValue(50);
    mockCampaignAttributionGroupBy
      .mockResolvedValueOnce([
        {
          attributionType: "FIRST_TOUCH",
          _sum: { conversionValue: 5000 },
          _count: { _all: 50 },
        },
        {
          attributionType: "LAST_TOUCH",
          _sum: { conversionValue: 4500 },
          _count: { _all: 45 },
        },
        {
          attributionType: "LINEAR",
          _sum: { conversionValue: 4200 },
          _count: { _all: 200 },
        },
        {
          attributionType: "TIME_DECAY",
          _sum: { conversionValue: 4800 },
          _count: { _all: 200 },
        },
        {
          attributionType: "POSITION_BASED",
          _sum: { conversionValue: 4900 },
          _count: { _all: 200 },
        },
      ])
      .mockResolvedValueOnce([
        {
          platform: "GOOGLE_ADS",
          attributionType: "FIRST_TOUCH",
          _sum: { conversionValue: 2000 },
          _count: { _all: 20 },
        },
        {
          platform: "FACEBOOK",
          attributionType: "LAST_TOUCH",
          _sum: { conversionValue: 1500 },
          _count: { _all: 15 },
        },
      ]);

    const result = await getGlobalAttributionSummary(startDate, endDate);

    expect(result.totalConversions).toBe(50);
    expect(result.comparison).toHaveLength(5);
    expect(result.platformBreakdown).toHaveLength(2);
  });

  it("returns zero values for models not in group-by results", async () => {
    mockCampaignAttributionCount.mockResolvedValue(0);
    mockCampaignAttributionGroupBy
      .mockResolvedValueOnce([]) // no model stats
      .mockResolvedValueOnce([]); // no platform stats

    const result = await getGlobalAttributionSummary(startDate, endDate);

    expect(result.comparison).toHaveLength(5);
    for (const model of result.comparison) {
      expect(model.value).toBe(0);
    }
    expect(result.platformBreakdown).toEqual([]);
  });

  it("compares all attribution models in comparison array", async () => {
    mockCampaignAttributionCount.mockResolvedValue(10);
    mockCampaignAttributionGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await getGlobalAttributionSummary(startDate, endDate);

    const models = result.comparison.map((c) => c.model);
    expect(models).toContain("FIRST_TOUCH");
    expect(models).toContain("LAST_TOUCH");
    expect(models).toContain("LINEAR");
    expect(models).toContain("TIME_DECAY");
    expect(models).toContain("POSITION_BASED");
  });

  it("maps platform breakdown with UNKNOWN for null platform", async () => {
    mockCampaignAttributionCount.mockResolvedValue(5);
    mockCampaignAttributionGroupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        platform: null,
        attributionType: "FIRST_TOUCH",
        _sum: { conversionValue: 500 },
        _count: { _all: 5 },
      },
    ]);

    const result = await getGlobalAttributionSummary(startDate, endDate);

    const unknownPlatform = result.platformBreakdown.find((p) => p.platform === "UNKNOWN");
    expect(unknownPlatform).toBeDefined();
    expect(unknownPlatform!.conversionCount).toBe(5);
    expect(unknownPlatform!.value).toBe(500);
  });

  it("uses FIRST_TOUCH count for totalConversions in comparison", async () => {
    mockCampaignAttributionCount.mockResolvedValue(42);
    mockCampaignAttributionGroupBy
      .mockResolvedValueOnce([
        {
          attributionType: "FIRST_TOUCH",
          _sum: { conversionValue: 1000 },
          _count: { _all: 42 },
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getGlobalAttributionSummary(startDate, endDate);

    const firstTouchComparison = result.comparison.find((c) => c.model === "FIRST_TOUCH");
    expect(firstTouchComparison!.conversionCount).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// direct attribution (no sessions, user exists)
// ---------------------------------------------------------------------------
describe("direct attribution flow", () => {
  it("creates a visitor session with direct prefix when no sessions exist", async () => {
    mockVisitorSessionFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({ id: "user-new" });
    mockVisitorSessionCreate.mockResolvedValue(makeSession({ id: "direct-sess" }));
    mockCampaignAttributionCreateMany.mockResolvedValue({ count: 5 });

    await attributeConversion("user-new", "SIGNUP", 0);

    expect(mockVisitorSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visitorId: "direct_user-new",
          userId: "user-new",
          landingPage: "/",
          pageViewCount: 0,
        }),
      }),
    );
  });

  it("creates 5 attribution types with DIRECT platform in bulk", async () => {
    mockVisitorSessionFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({ id: "user-new" });
    mockVisitorSessionCreate.mockResolvedValue(makeSession({ id: "direct-sess" }));
    mockCampaignAttributionCreateMany.mockResolvedValue({ count: 5 });

    await attributeConversion("user-new", "PURCHASE", 50);

    const createManyCall = mockCampaignAttributionCreateMany.mock.calls[0]![0] as {
      data: Array<{ platform: string; attributionType: string }>;
    };
    expect(createManyCall.data).toHaveLength(5);
    for (const record of createManyCall.data) {
      expect(record.platform).toBe("DIRECT");
    }
    const types = createManyCall.data.map((r) => r.attributionType);
    expect(types).toContain("FIRST_TOUCH");
    expect(types).toContain("LAST_TOUCH");
    expect(types).toContain("LINEAR");
    expect(types).toContain("TIME_DECAY");
    expect(types).toContain("POSITION_BASED");
  });
});
