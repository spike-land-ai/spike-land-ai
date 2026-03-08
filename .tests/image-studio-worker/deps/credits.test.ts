import { describe, expect, it, vi } from "vitest";
import { createD1Credits } from "../../../src/edge-api/image-studio-worker/mcp/credits.ts";
import type { Env } from "../../../src/edge-api/image-studio-worker/env.d.ts";

describe("credits", () => {
  it("hasEnough returns true if remaining >= amount", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const mockFirst = vi.fn().mockResolvedValue({ remaining: 100 });
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: mockRun,
          first: mockFirst,
        }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.hasEnough("user1", 50);
    expect(res).toBe(true);
  });

  it("consume returns success and inserts transaction", async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockFirst = vi.fn().mockResolvedValue({ remaining: 90 });
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: mockRun,
          first: mockFirst,
        }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.consume({
      userId: "user1",
      amount: 10,
      source: "test",
    });
    expect(res.success).toBe(true);
    expect(res.remaining).toBe(90);
  });

  it("consume returns error if changes == 0", async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.consume({
      userId: "user1",
      amount: 10,
      source: "test",
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("Insufficient credits");
  });

  it("refund works", async () => {
    const mockRun = vi.fn().mockResolvedValue({});
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: mockRun }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.refund("user1", 10);
    expect(res).toBe(true);
  });

  it("getBalance works", async () => {
    const mockFirst = vi.fn().mockResolvedValue({ remaining: 42 });
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: mockFirst,
        }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.getBalance("user1");
    expect(res?.remaining).toBe(42);
  });

  it("getBalance returns null if not found", async () => {
    const mockFirst = vi.fn().mockResolvedValue(null);
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
          first: mockFirst,
        }),
      }),
    } as unknown as D1Database;

    const credits = createD1Credits({ IMAGE_DB: db } as unknown as Env);
    const res = await credits.getBalance("user1");
    expect(res).toBeNull();
  });

  it("estimate with defaults", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as unknown as D1Database } as unknown as Env);
    expect(credits.estimate("TIER_1K")).toBe(2);
  });

  it("calculateGenerationCost with defaults", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as unknown as D1Database } as unknown as Env);
    expect(credits.calculateGenerationCost({ tier: "TIER_2K" })).toBe(5);
    expect(credits.calculateGenerationCost({ tier: "UNKNOWN" as unknown as "TIER_2K" })).toBe(1);
  });

  it("estimate", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as unknown as D1Database } as unknown as Env);
    expect(credits.estimate("TIER_1K", 2)).toBe(4);
  });

  it("calculateGenerationCost", () => {
    const credits = createD1Credits({ IMAGE_DB: {} as unknown as D1Database } as unknown as Env);
    expect(credits.calculateGenerationCost({ tier: "TIER_2K", numImages: 3 })).toBe(15);
  });
});
