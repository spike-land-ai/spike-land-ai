import { describe, expect, it, vi } from "vitest";

const { mockRedisSet, mockRedisGet, mockRedisDel, mockPublishSSEEvent, mockGetSSEEvents } =
  vi.hoisted(() => ({
    mockRedisSet: vi.fn(),
    mockRedisGet: vi.fn(),
    mockRedisDel: vi.fn(),
    mockPublishSSEEvent: vi.fn(),
    mockGetSSEEvents: vi.fn(),
  }));

vi.mock("@/lib/upstash", () => ({
  redis: {
    set: mockRedisSet,
    get: mockRedisGet,
    del: mockRedisDel,
  },
  publishSSEEvent: mockPublishSSEEvent,
  getSSEEvents: mockGetSSEEvents,
}));

import {
  ARENA_KEYS,
  cacheChallengeList,
  cacheLeaderboard,
  getArenaEvents,
  getCachedChallengeList,
  getCachedLeaderboard,
  getSubmissionState,
  isSubmissionWorking,
  publishArenaEvent,
  setSubmissionState,
  setSubmissionWorking,
} from "./redis";

describe("ARENA_KEYS", () => {
  it("SUBMISSION_STATE generates correct key", () => {
    expect(ARENA_KEYS.SUBMISSION_STATE("sub-1")).toBe("arena:submission:sub-1:state");
  });

  it("SUBMISSION_WORKING generates correct key", () => {
    expect(ARENA_KEYS.SUBMISSION_WORKING("sub-2")).toBe("arena:submission:sub-2:working");
  });

  it("SSE_EVENTS generates correct key", () => {
    expect(ARENA_KEYS.SSE_EVENTS("sub-3")).toBe("arena:sse:sub-3:events");
  });

  it("LEADERBOARD_CACHE is a fixed string", () => {
    expect(ARENA_KEYS.LEADERBOARD_CACHE).toBe("arena:leaderboard:top50");
  });

  it("CHALLENGE_LIST_CACHE is a fixed string", () => {
    expect(ARENA_KEYS.CHALLENGE_LIST_CACHE).toBe("arena:challenges:open");
  });
});

describe("setSubmissionState", () => {
  beforeEach(() => mockRedisSet.mockReset());

  it("calls redis.set with correct key, value, and 300s TTL", async () => {
    mockRedisSet.mockResolvedValue("OK");
    await setSubmissionState("sub-1", "processing");
    expect(mockRedisSet).toHaveBeenCalledWith("arena:submission:sub-1:state", "processing", {
      ex: 300,
    });
  });
});

describe("getSubmissionState", () => {
  beforeEach(() => mockRedisGet.mockReset());

  it("returns the value from Redis", async () => {
    mockRedisGet.mockResolvedValue("processing");
    const result = await getSubmissionState("sub-1");
    expect(result).toBe("processing");
    expect(mockRedisGet).toHaveBeenCalledWith("arena:submission:sub-1:state");
  });

  it("returns null when key does not exist", async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getSubmissionState("sub-1");
    expect(result).toBeNull();
  });
});

describe("setSubmissionWorking", () => {
  beforeEach(() => {
    mockRedisSet.mockReset();
    mockRedisDel.mockReset();
  });

  it("sets '1' with 300s TTL when isWorking=true", async () => {
    mockRedisSet.mockResolvedValue("OK");
    await setSubmissionWorking("sub-1", true);
    expect(mockRedisSet).toHaveBeenCalledWith("arena:submission:sub-1:working", "1", { ex: 300 });
  });

  it("deletes the key when isWorking=false", async () => {
    mockRedisDel.mockResolvedValue(1);
    await setSubmissionWorking("sub-1", false);
    expect(mockRedisDel).toHaveBeenCalledWith("arena:submission:sub-1:working");
    expect(mockRedisSet).not.toHaveBeenCalled();
  });
});

describe("isSubmissionWorking", () => {
  beforeEach(() => mockRedisGet.mockReset());

  it("returns true when value is '1'", async () => {
    mockRedisGet.mockResolvedValue("1");
    expect(await isSubmissionWorking("sub-1")).toBe(true);
  });

  it("returns false when value is null", async () => {
    mockRedisGet.mockResolvedValue(null);
    expect(await isSubmissionWorking("sub-1")).toBe(false);
  });

  it("returns false for any non-'1' value", async () => {
    mockRedisGet.mockResolvedValue("0");
    expect(await isSubmissionWorking("sub-1")).toBe(false);
  });
});

describe("publishArenaEvent", () => {
  beforeEach(() => mockPublishSSEEvent.mockReset());

  it("calls publishSSEEvent with the prefixed channel and event + timestamp", async () => {
    mockPublishSSEEvent.mockResolvedValue(undefined);
    await publishArenaEvent("sub-1", { type: "progress", data: { pct: 50 } } as never);
    expect(mockPublishSSEEvent).toHaveBeenCalledWith(
      "arena:sub-1",
      expect.objectContaining({
        type: "progress",
        data: { pct: 50 },
        timestamp: expect.any(Number),
      }),
    );
  });
});

describe("getArenaEvents", () => {
  beforeEach(() => mockGetSSEEvents.mockReset());

  it("calls getSSEEvents with correct channel and timestamp", async () => {
    mockGetSSEEvents.mockResolvedValue([]);
    await getArenaEvents("sub-1", 12345);
    expect(mockGetSSEEvents).toHaveBeenCalledWith("arena:sub-1", 12345);
  });
});

describe("cacheLeaderboard / getCachedLeaderboard", () => {
  beforeEach(() => {
    mockRedisSet.mockReset();
    mockRedisGet.mockReset();
  });

  it("cacheLeaderboard serializes and stores with 60s TTL", async () => {
    mockRedisSet.mockResolvedValue("OK");
    const data = [{ id: 1, score: 100 }];
    await cacheLeaderboard(data);
    expect(mockRedisSet).toHaveBeenCalledWith("arena:leaderboard:top50", JSON.stringify(data), {
      ex: 60,
    });
  });

  it("getCachedLeaderboard returns null when cache is empty", async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getCachedLeaderboard();
    expect(result).toBeNull();
  });

  it("getCachedLeaderboard parses and returns JSON string", async () => {
    const data = [{ id: 1, score: 100 }];
    mockRedisGet.mockResolvedValue(JSON.stringify(data));
    const result = await getCachedLeaderboard<typeof data>();
    expect(result).toEqual(data);
  });

  it("getCachedLeaderboard returns non-string value directly", async () => {
    const data = { score: 100 };
    mockRedisGet.mockResolvedValue(data);
    const result = await getCachedLeaderboard();
    expect(result).toEqual(data);
  });
});

describe("cacheChallengeList / getCachedChallengeList", () => {
  beforeEach(() => {
    mockRedisSet.mockReset();
    mockRedisGet.mockReset();
  });

  it("cacheChallengeList serializes and stores with 30s TTL", async () => {
    mockRedisSet.mockResolvedValue("OK");
    const data = ["challenge-1"];
    await cacheChallengeList(data);
    expect(mockRedisSet).toHaveBeenCalledWith("arena:challenges:open", JSON.stringify(data), {
      ex: 30,
    });
  });

  it("getCachedChallengeList returns null when cache is empty", async () => {
    mockRedisGet.mockResolvedValue(null);
    const result = await getCachedChallengeList();
    expect(result).toBeNull();
  });

  it("getCachedChallengeList parses JSON string", async () => {
    const data = ["challenge-1", "challenge-2"];
    mockRedisGet.mockResolvedValue(JSON.stringify(data));
    const result = await getCachedChallengeList<string[]>();
    expect(result).toEqual(data);
  });
});
