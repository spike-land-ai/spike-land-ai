import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps } from "../__test-utils__/mock-deps.js";
import { credits } from "./credits.js";
import type { EnhancementTier, ToolContext } from "../types.js";

describe("credits", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  // ── Balance only (no tier) ──

  it("should return the remaining balance", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 42 });

    const result = await credits({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.remaining).toBe(42);
    expect(data.estimate).toBeUndefined();
  });

  it("should return BALANCE_ERROR when getBalance throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockRejectedValue(new Error("DB connection lost"));

    const result = await credits({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BALANCE_ERROR");
    expect(result.content[0].text).toContain("DB connection lost");
  });

  it("should return BALANCE_ERROR with default fallback string when getBalance throws without an error", async () => {
    const ctx: ToolContext = { userId, deps };
    const err = new Error();
    Object.defineProperty(err, "message", { value: undefined });
    mocks.credits.getBalance.mockRejectedValue(err);

    const result = await credits({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BALANCE_ERROR");
    expect(result.content[0].text).toContain("Could not retrieve credit balance");
  });

  it("should return BALANCE_NOT_FOUND when getBalance returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue(null);

    const result = await credits({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BALANCE_NOT_FOUND");
  });

  // ── With tier estimate — single unit ──

  it("should include an estimate when tier is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 100 });
    mocks.credits.hasEnough.mockResolvedValue(true);

    const result = await credits({ tier: "TIER_1K" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.remaining).toBe(100);
    expect(data.estimate).toBeDefined();
    expect(data.estimate.tier).toBe("TIER_1K");
    expect(data.estimate.count).toBe(1);
    expect(data.estimate.costPerUnit).toBe(2);
    expect(data.estimate.totalCost).toBe(2);
    expect(data.estimate.canAfford).toBe(true);
  });

  it("should show canAfford:false when balance is insufficient for the tier", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 1 });
    mocks.credits.hasEnough.mockResolvedValue(false);

    const result = await credits({ tier: "TIER_4K" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.estimate.costPerUnit).toBe(10);
    expect(data.estimate.totalCost).toBe(10);
    expect(data.estimate.canAfford).toBe(false);
  });

  it("should compute totalCost based on count", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 100 });
    mocks.credits.hasEnough.mockResolvedValue(true);

    const result = await credits({ tier: "TIER_2K", count: 3 }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.estimate.costPerUnit).toBe(5);
    expect(data.estimate.count).toBe(3);
    expect(data.estimate.totalCost).toBe(15);
    expect(mocks.credits.hasEnough).toHaveBeenCalledWith(userId, 15);
  });

  it("should include FREE tier estimate with zero cost", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 0 });
    mocks.credits.hasEnough.mockResolvedValue(true);

    const result = await credits({ tier: "FREE", count: 5 }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.estimate.costPerUnit).toBe(0);
    expect(data.estimate.totalCost).toBe(0);
    expect(data.estimate.canAfford).toBe(true);
  });

  it("should set canAfford:false when hasEnough throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 50 });
    mocks.credits.hasEnough.mockRejectedValue(new Error("Credit service error"));

    const result = await credits({ tier: "TIER_1K" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // tryCatch returns ok:false when it throws, so canAfford falls back to false
    expect(data.estimate.canAfford).toBe(false);
  });

  // ── All tiers ──

  it("should correctly price TIER_4K at 10 credits per unit", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 200 });
    mocks.credits.hasEnough.mockResolvedValue(true);

    const result = await credits({ tier: "TIER_4K", count: 2 }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.estimate.costPerUnit).toBe(10);
    expect(data.estimate.totalCost).toBe(20);
  });

  it("should return INVALID_TIER when given an unknown tier", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.getBalance.mockResolvedValue({ remaining: 200 });

    // cast to bypass types for testing invalid input
    const result = await credits({ tier: "FAKE_TIER" as unknown as EnhancementTier }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});
