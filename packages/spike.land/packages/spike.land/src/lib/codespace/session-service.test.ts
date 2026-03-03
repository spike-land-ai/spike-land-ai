import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ICodeSession } from "./types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockQueryRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    codespaceSession: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      upsert: (...args: unknown[]) => mockUpsert(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
    },
    codespaceVersion: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
      create: (...args: unknown[]) => mockCreate(...args),
    },
  },
}));

const mockRedisGet = vi.fn();
const mockRedisSet = vi.fn();
const mockRedisDel = vi.fn();
const mockRedisMget = vi.fn();
vi.mock("@/lib/upstash", () => ({
  redis: {
    get: (...args: unknown[]) => mockRedisGet(...args),
    set: (...args: unknown[]) => mockRedisSet(...args),
    del: (...args: unknown[]) => mockRedisDel(...args),
    mget: (...args: unknown[]) => mockRedisMget(...args),
  },
  publishSSEEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const { SessionService } = await import("./session-service");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbSession(overrides: Partial<{
  id: string;
  codeSpace: string;
  code: string;
  transpiled: string;
  html: string;
  css: string;
  hash: string;
  messages: unknown;
  requiresReRender: boolean;
  appId: string | null;
}> = {}) {
  return {
    id: "cuid-123",
    codeSpace: "my-app",
    code: "const x = 1;",
    transpiled: "var x = 1;",
    html: "<div></div>",
    css: "",
    hash: "abc123",
    messages: [],
    requiresReRender: false,
    appId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // getSession
  // -------------------------------------------------------------------------

  describe("getSession", () => {
    it("should return cached session from Redis", async () => {
      const cached: ICodeSession = {
        code: "cached code",
        codeSpace: "my-app",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      };
      mockRedisGet.mockResolvedValue(cached);

      const result = await SessionService.getSession("my-app");

      expect(result).toEqual(cached);
      expect(mockRedisGet).toHaveBeenCalledWith("codespace:session:my-app");
      expect(mockFindUnique).not.toHaveBeenCalled();
    });

    it("should fall back to PostgreSQL when Redis misses", async () => {
      mockRedisGet.mockResolvedValue(null);

      const dbRow = makeDbSession();
      mockFindUnique.mockResolvedValue(dbRow);
      mockRedisSet.mockResolvedValue("OK");

      const result = await SessionService.getSession("my-app");

      expect(result).not.toBeNull();
      expect(result!.code).toBe("const x = 1;");
      expect(result!.codeSpace).toBe("my-app");
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { codeSpace: "my-app" },
      });
      // Should cache the result
      expect(mockRedisSet).toHaveBeenCalled();
    });

    it("should return null when session not found", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(null);

      const result = await SessionService.getSession("nonexistent");
      expect(result).toBeNull();
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedisGet.mockRejectedValue(new Error("Redis down"));
      mockFindUnique.mockResolvedValue(makeDbSession());
      mockRedisSet.mockResolvedValue("OK");

      const result = await SessionService.getSession("my-app");
      expect(result).not.toBeNull();
      expect(result!.code).toBe("const x = 1;");
    });
  });

  // -------------------------------------------------------------------------
  // checkSessionsHealth (Batch)
  // -------------------------------------------------------------------------

  describe("checkSessionsHealth", () => {
    it("should return cached health status for all items if present", async () => {
      mockRedisMget.mockResolvedValue([true, false]);

      const result = await SessionService.checkSessionsHealth([
        "app-1",
        "app-2",
      ]);

      expect(result.get("app-1")).toBe(true);
      expect(result.get("app-2")).toBe(false);
      expect(mockRedisMget).toHaveBeenCalledWith(
        "codespace:health:app-1",
        "codespace:health:app-2",
      );
      expect(mockQueryRaw).not.toHaveBeenCalled();
    });

    it("should fetch missing items from DB and cache them", async () => {
      // app-1 cached (true), app-2 missing (null)
      mockRedisMget.mockResolvedValue([true, null]);

      // DB returns app-2 as healthy
      mockQueryRaw.mockResolvedValue([{
        codeSpace: "app-2",
        is_healthy: true,
      }]);

      const result = await SessionService.checkSessionsHealth([
        "app-1",
        "app-2",
      ]);

      expect(result.get("app-1")).toBe(true);
      expect(result.get("app-2")).toBe(true);

      // Should have queried for app-2
      expect(mockQueryRaw).toHaveBeenCalled();

      // Should have updated cache for app-2
      expect(mockRedisSet).toHaveBeenCalledWith(
        "codespace:health:app-2",
        true,
        expect.any(Object),
      );
    });

    it("should mark items missing from DB as unhealthy", async () => {
      mockRedisMget.mockResolvedValue([null]);
      mockQueryRaw.mockResolvedValue([]); // DB returns nothing

      const result = await SessionService.checkSessionsHealth(["missing-app"]);

      expect(result.get("missing-app")).toBe(false);

      // Should cache the negative result
      expect(mockRedisSet).toHaveBeenCalledWith(
        "codespace:health:missing-app",
        false,
        expect.any(Object),
      );
    });

    it("should handle empty input array", async () => {
      const result = await SessionService.checkSessionsHealth([]);
      expect(result.size).toBe(0);
      expect(mockRedisMget).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // initializeSession
  // -------------------------------------------------------------------------

  describe("initializeSession", () => {
    it("should create a new session with default template", async () => {
      mockUpsert.mockResolvedValue(makeDbSession({ codeSpace: "new-space" }));
      mockRedisDel.mockResolvedValue(1);

      const result = await SessionService.initializeSession("new-space");

      expect(result.codeSpace).toBe("new-space");
      expect(result.code).toBeTruthy(); // Should have default template code
      expect(mockUpsert).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalledWith("codespace:session:new-space");
    });
  });

  // -------------------------------------------------------------------------
  // getOrCreateSession
  // -------------------------------------------------------------------------

  describe("getOrCreateSession", () => {
    it("should return existing session if found", async () => {
      const existing: ICodeSession = {
        code: "existing",
        codeSpace: "my-app",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      };
      mockRedisGet.mockResolvedValue(existing);

      const result = await SessionService.getOrCreateSession("my-app");
      expect(result.code).toBe("existing");
    });

    it("should initialize a new session if not found", async () => {
      mockRedisGet.mockResolvedValue(null);
      mockFindUnique.mockResolvedValue(null);
      mockUpsert.mockResolvedValue(makeDbSession({ codeSpace: "new-space" }));
      mockRedisDel.mockResolvedValue(1);

      const result = await SessionService.getOrCreateSession("new-space");
      expect(result.codeSpace).toBe("new-space");
      expect(mockUpsert).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // upsertSession
  // -------------------------------------------------------------------------

  describe("upsertSession", () => {
    it("should upsert session and invalidate cache", async () => {
      const session: ICodeSession = {
        code: "new code",
        codeSpace: "my-app",
        transpiled: "transpiled",
        html: "<div></div>",
        css: "",
        messages: [],
      };
      mockUpsert.mockResolvedValue(makeDbSession());
      mockRedisDel.mockResolvedValue(1);

      const result = await SessionService.upsertSession(session);

      expect(result.code).toBe("new code");
      expect(mockUpsert).toHaveBeenCalled();
      expect(mockRedisDel).toHaveBeenCalledWith("codespace:session:my-app");
    });
  });

  // -------------------------------------------------------------------------
  // updateSession (optimistic locking)
  // -------------------------------------------------------------------------

  describe("updateSession", () => {
    it("should update session when hash matches", async () => {
      mockUpdateMany.mockResolvedValue({ count: 1 });
      mockRedisDel.mockResolvedValue(1);
      mockFindUnique.mockResolvedValue(makeDbSession({ appId: null }));

      const newSession: ICodeSession = {
        code: "updated",
        codeSpace: "my-app",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      };

      const result = await SessionService.updateSession(
        "my-app",
        newSession,
        "expected-hash",
      );

      expect(result.success).toBe(true);
      expect(result.session).toBeDefined();
    });

    it("should return conflict when hash mismatches", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(
        makeDbSession({ hash: "actual-hash" }),
      );

      const newSession: ICodeSession = {
        code: "updated",
        codeSpace: "my-app",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      };

      const result = await SessionService.updateSession(
        "my-app",
        newSession,
        "wrong-hash",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Conflict: Hash mismatch");
    });

    it("should return error when codespace not found", async () => {
      mockUpdateMany.mockResolvedValue({ count: 0 });
      mockFindUnique.mockResolvedValue(null);

      const newSession: ICodeSession = {
        code: "updated",
        codeSpace: "nonexistent",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      };

      const result = await SessionService.updateSession(
        "nonexistent",
        newSession,
        "some-hash",
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Codespace not found");
    });
  });

  // -------------------------------------------------------------------------
  // saveVersion
  // -------------------------------------------------------------------------

  describe("saveVersion", () => {
    it("should create a new version", async () => {
      mockFindUnique.mockResolvedValue(makeDbSession());
      mockFindFirst.mockResolvedValue({ number: 3 });
      mockCreate.mockResolvedValue({
        number: 4,
        code: "const x = 1;",
        transpiled: "var x = 1;",
        html: "<div></div>",
        css: "",
        hash: "abc123",
        createdAt: new Date("2026-01-01"),
      });

      const result = await SessionService.saveVersion("my-app");

      expect(result).not.toBeNull();
      expect(result!.number).toBe(4);
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should return null if session not found", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await SessionService.saveVersion("nonexistent");
      expect(result).toBeNull();
    });

    it("should start at version 1 when no versions exist", async () => {
      mockFindUnique.mockResolvedValue(makeDbSession());
      mockFindFirst.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        number: 1,
        code: "const x = 1;",
        transpiled: "var x = 1;",
        html: "<div></div>",
        css: "",
        hash: "abc123",
        createdAt: new Date("2026-01-01"),
      });

      const result = await SessionService.saveVersion("my-app");

      expect(result).not.toBeNull();
      expect(result!.number).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // getVersion
  // -------------------------------------------------------------------------

  describe("getVersion", () => {
    it("should return a version by number", async () => {
      mockFindFirst.mockResolvedValue({
        number: 2,
        code: "const y = 2;",
        transpiled: "var y = 2;",
        html: "<p></p>",
        css: ".p {}",
        hash: "def456",
        createdAt: new Date("2026-01-02"),
      });

      const result = await SessionService.getVersion("my-app", 2);

      expect(result).not.toBeNull();
      expect(result!.number).toBe(2);
      expect(result!.code).toBe("const y = 2;");
    });

    it("should return null when version not found", async () => {
      mockFindFirst.mockResolvedValue(null);

      const result = await SessionService.getVersion("my-app", 999);
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // getVersionsList
  // -------------------------------------------------------------------------

  describe("getVersionsList", () => {
    it("should return versions list with timestamps", async () => {
      mockFindMany.mockResolvedValue([
        { number: 2, hash: "abc", createdAt: new Date("2026-01-02") },
        { number: 1, hash: "def", createdAt: new Date("2026-01-01") },
      ]);

      const result = await SessionService.getVersionsList("my-app");

      expect(result).toHaveLength(2);
      expect(result[0]!.number).toBe(2);
      expect(typeof result[0]!.createdAt).toBe("number");
    });

    it("should return empty array when no versions exist", async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await SessionService.getVersionsList("my-app");
      expect(result).toEqual([]);
    });
  });
});
