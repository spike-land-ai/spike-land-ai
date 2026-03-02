import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps } from "../__test-utils__/mock-deps.js";
import { avatar } from "./avatar.js";
import type { ToolContext } from "../types.js";

describe("avatar", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should generate avatar from prompt (happy path)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-1",
      creditsCost: 2,
    });

    const result = await avatar({ prompt: "A friendly robot face" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("gen-job-1");
    expect(data.aspect_ratio).toBe("1:1");
    expect(data.creditsCost).toBe(2);
  });

  it("should default to photo style and TIER_1K", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-2",
      creditsCost: 2,
    });

    await avatar({ prompt: "Wizard" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("photo");
    expect(call.tier).toBe("TIER_1K");
  });

  it("should apply cartoon style in the generation prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-3",
      creditsCost: 2,
    });

    await avatar({ prompt: "Pirate", style: "cartoon" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("cartoon");
    expect(call.prompt).toContain("Pirate");
  });

  it("should apply pixel style in the generation prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-4",
      creditsCost: 2,
    });

    await avatar({ prompt: "Ninja", style: "pixel" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("pixel");
  });

  it("should send aspect ratio 1:1 to generation job", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-5",
      creditsCost: 2,
    });

    await avatar({ prompt: "Warrior" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.aspectRatio).toBe("1:1");
  });

  it("should return INSUFFICIENT_CREDITS when credits check fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const result = await avatar({ prompt: "Knight" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return INSUFFICIENT_CREDITS when credits check throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockRejectedValue(new Error("Credit service error"));

    const result = await avatar({ prompt: "Knight" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return GENERATION_FAILED when createGenerationJob returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "Server error",
    });

    const result = await avatar({ prompt: "Dragon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when createGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockRejectedValue(new Error("timeout"));

    const result = await avatar({ prompt: "Dragon" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should consume credits after successful generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-6",
      creditsCost: 2,
    });

    await avatar({ prompt: "Elf" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "avatar" }),
    );
  });

  it("should use creditsCost from job response when available", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-7",
      creditsCost: 10,
    });

    const result = await avatar({ prompt: "Cyborg", tier: "TIER_4K" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(10);
  });

  it("should fallback to base cost when creditsCost is omitted from job response", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-8",
      // explicitly missing creditsCost
    });

    // TIER_1K costs 2 credits
    const result = await avatar({ prompt: "Alien", tier: "TIER_1K" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(2);
  });
});
