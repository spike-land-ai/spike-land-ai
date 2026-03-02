import { describe, it, expect, vi } from "vitest";
import { hashApiKey, lookupApiKey } from "./api-key";

describe("hashApiKey", () => {
  it("returns a hex string", async () => {
    const hash = await hashApiKey("sk_test_abc123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns same hash for same input", async () => {
    const h1 = await hashApiKey("sk_test_abc123");
    const h2 = await hashApiKey("sk_test_abc123");
    expect(h1).toBe(h2);
  });

  it("returns different hash for different input", async () => {
    const h1 = await hashApiKey("sk_test_abc123");
    const h2 = await hashApiKey("sk_test_xyz789");
    expect(h1).not.toBe(h2);
  });
});

describe("lookupApiKey", () => {
  function createMockDb(rows: Array<{ userId: string; expiresAt: number | null }>) {
    const mockLimit = vi.fn().mockResolvedValue(rows);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    // Also mock update chain for the lastUsedAt fire-and-forget
    const mockRun = vi.fn().mockResolvedValue(undefined);
    const mockUpdateWhere = vi.fn().mockReturnValue({ run: mockRun });
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

    return {
      select: mockSelect,
      update: mockUpdate,
      _mocks: { mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate },
    } as unknown as Parameters<typeof lookupApiKey>[1];
  }

  it("returns userId for valid key", async () => {
    const db = createMockDb([{ userId: "user-abc", expiresAt: null }]);

    const result = await lookupApiKey("sk_test_valid", db);
    expect(result).toEqual({ userId: "user-abc" });
  });

  it("returns null for unknown key", async () => {
    const db = createMockDb([]);

    const result = await lookupApiKey("sk_test_unknown", db);
    expect(result).toBeNull();
  });

  it("returns null for expired key", async () => {
    const pastTimestamp = Date.now() - 60_000; // expired 1 minute ago
    const db = createMockDb([{ userId: "user-expired", expiresAt: pastTimestamp }]);

    const result = await lookupApiKey("sk_test_expired", db);
    expect(result).toBeNull();
  });

  it("returns userId for key with future expiration", async () => {
    const futureTimestamp = Date.now() + 3_600_000; // expires in 1 hour
    const db = createMockDb([{ userId: "user-valid", expiresAt: futureTimestamp }]);

    const result = await lookupApiKey("sk_test_future", db);
    expect(result).toEqual({ userId: "user-valid" });
  });
});
