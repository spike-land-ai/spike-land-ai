import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps } from "../__test-utils__/mock-deps.js";
import { diagram } from "../../../src/mcp-tools/image-studio/tools/diagram.js";
import type { ToolContext } from "../../../src/mcp-tools/image-studio/types.js";

describe("diagram", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should generate architecture diagram via advanced job (happy path)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-1",
      creditsCost: 3,
    });

    const result = await diagram({ prompt: "Show microservices communicating" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-gen-job-1");
    expect(data.diagram_type).toBe("architecture");
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.creditsCost).toBe(3);
  });

  it("should use 3:4 aspect ratio for sequence diagrams", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-2",
      creditsCost: 3,
    });

    const result = await diagram({ prompt: "Auth flow", type: "sequence" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("3:4");
    expect(data.diagram_type).toBe("sequence");
  });

  it("should use 16:9 aspect ratio for non-sequence diagrams", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-3",
      creditsCost: 3,
    });

    const result = await diagram({ prompt: "Database schema", type: "er" }, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.diagram_type).toBe("er");
  });

  it("should pass thinkingMode option to advanced job", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-4",
      creditsCost: 3,
    });

    await diagram({ prompt: "Network topology", type: "network" }, ctx);

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.options.thinkingMode).toBe(true);
  });

  it("should include diagram type and style in prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-5",
      creditsCost: 3,
    });

    await diagram(
      {
        prompt: "CI pipeline steps",
        type: "flowchart",
        style: "hand_drawn",
      },
      ctx,
    );

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("flowchart");
    expect(call.prompt).toContain("hand_drawn");
    expect(call.prompt).toContain("CI pipeline steps");
  });

  it("should fall back to createGenerationJob when createAdvancedGenerationJob is undefined", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob = undefined;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-1",
      creditsCost: 2,
    });

    const result = await diagram({ prompt: "System overview" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("gen-job-1");
    expect(mocks.generation.createGenerationJob).toHaveBeenCalledOnce();
    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.aspectRatio).toBe("16:9");
  });

  it("should pass correct aspectRatio to fallback job for sequence type", async () => {
    const ctx: ToolContext = { userId, deps };
    (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob = undefined;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-2",
      creditsCost: 2,
    });

    await diagram({ prompt: "Login sequence", type: "sequence" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.aspectRatio).toBe("3:4");
  });

  it("should return INSUFFICIENT_CREDITS when credits check fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Insufficient credits",
    });

    const result = await diagram({ prompt: "Flow diagram" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return INSUFFICIENT_CREDITS when credits check throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.consume.mockRejectedValue(new Error("Credit service error"));

    const result = await diagram({ prompt: "Flow diagram" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return GENERATION_FAILED when advanced job returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
      error: "Model unavailable",
    });

    const result = await diagram({ prompt: "Kubernetes cluster" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when advanced job throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockRejectedValue(new Error("timeout"));

    const result = await diagram({ prompt: "Kubernetes cluster" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when fallback createGenerationJob returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob = undefined;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "Quota hit",
    });

    const result = await diagram({ prompt: "Network map" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should consume credits after successful advanced generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-6",
      creditsCost: 3,
    });

    await diagram({ prompt: "Data flow" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "diagram" }),
    );
  });

  it("should consume credits after successful fallback generation", async () => {
    const ctx: ToolContext = { userId, deps };
    delete (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-3",
      creditsCost: 2,
    });

    await diagram({ prompt: "System flow" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "diagram" }),
    );
  });

  it("should use default cost if advanced job omits creditsCost", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-job-8",
    });

    const result = await diagram({ prompt: "Cloud infra", tier: "TIER_4K" }, ctx);

    const data = JSON.parse(result.content[0].text);
    // TIER_4K costs 10
    expect(data.creditsCost).toBe(10);
  });

  it("should use default cost if fallback job omits creditsCost", async () => {
    const ctx: ToolContext = { userId, deps };
    delete (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-4",
    });

    const result = await diagram({ prompt: "Cloud infra", tier: "TIER_4K" }, ctx);

    const data = JSON.parse(result.content[0].text);
    // TIER_4K costs 10
    expect(data.creditsCost).toBe(10);
  });

  it("should return GENERATION_FAILED with fallback string when standard job fails without error msg", async () => {
    const ctx: ToolContext = { userId, deps };
    delete (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
    });

    const result = await diagram({ prompt: "Any prompt" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Failed to create diagram job");
  });

  it("should return GENERATION_FAILED when fallback createGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    delete (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob;
    mocks.generation.createGenerationJob.mockRejectedValue(new Error("Network fail"));

    const result = await diagram({ prompt: "Diagram" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network fail");
  });

  it("should return GENERATION_FAILED when advanced createAdvancedGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockRejectedValue(new Error("Advanced fail"));

    const result = await diagram({ prompt: "Diagram" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Advanced fail");
  });

  it("should return GENERATION_FAILED with fallback string when advanced job fails without error msg", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
    });

    const result = await diagram({ prompt: "Any prompt" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
    expect(result.content[0].text).toContain("Failed to create diagram job");
  });
});
