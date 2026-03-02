import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockPipelineRow } from "../__test-utils__/mock-deps.js";
import { pipelineSave } from "./pipeline-save.js";
import type { ToolContext } from "../types.js";
import { asPipelineId } from "../types.js";

describe("pipelineSave", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should create a new pipeline when no pipeline_id is provided", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const newPipeline = mockPipelineRow({
      id: asPipelineId("new-pipe"),
      name: "My Pipeline",
    });
    mocks.db.pipelineCreate.mockResolvedValue(newPipeline);

    const result = await pipelineSave({ name: "My Pipeline" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:created" }));
    expect(data.id).toBe("new-pipe");
    expect(data.name).toBe("My Pipeline");
    expect(data.action).toBe("created");
    expect(mocks.db.pipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Pipeline",
        userId,
        visibility: "PRIVATE",
      }),
    );
  });

  it("should create pipeline with configs", async () => {
    const ctx: ToolContext = { userId, deps };
    const analysisConfig = { mode: "detailed" };
    const promptConfig = { prefix: "Enhance this:" };
    mocks.db.pipelineCreate.mockResolvedValue(
      mockPipelineRow({ name: "Configured", analysisConfig, promptConfig }),
    );

    await pipelineSave(
      {
        name: "Configured",
        configs: { analysis: analysisConfig, prompt: promptConfig },
      },
      ctx,
    );

    expect(mocks.db.pipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({ analysisConfig, promptConfig }),
    );
  });

  it("should return error when pipeline create fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineCreate.mockRejectedValue(new Error("DB error"));

    const result = await pipelineSave({ name: "Fail Pipe" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_CREATE_FAILED");
  });

  it("should update an existing pipeline", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const existing = mockPipelineRow({
      id: asPipelineId("pipe-1"),
      name: "Updated Pipe",
    });
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(existing);
    mocks.db.pipelineUpdate.mockResolvedValue({
      ...existing,
      name: "Updated Pipe",
    });

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-1",
        name: "Updated Pipe",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:updated" }));
    expect(data.action).toBe("updated");
    expect(data.name).toBe("Updated Pipe");
    expect(mocks.db.pipelineUpdate).toHaveBeenCalled();
  });

  it("should return NOT_FOUND when updating non-existent pipeline", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(null);

    const result = await pipelineSave(
      {
        pipeline_id: "missing-pipe",
        name: "Test",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should return error when pipeline update fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(mockPipelineRow());
    mocks.db.pipelineUpdate.mockRejectedValue(new Error("DB error"));

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-1",
        name: "Fail Update",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPDATE_FAILED");
  });

  it("should fork a public pipeline", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const source = mockPipelineRow({
      id: asPipelineId("src-pipe"),
      visibility: "PUBLIC",
      userId: "other-user",
    });
    const forked = mockPipelineRow({
      id: asPipelineId("forked-pipe"),
      name: "Forked Pipe",
    });
    mocks.db.pipelineFindById.mockResolvedValue(source);
    mocks.db.pipelineCreate.mockResolvedValue(forked);

    const result = await pipelineSave(
      {
        pipeline_id: "src-pipe",
        fork: true,
        name: "Forked Pipe",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:created" }));
    expect(data.action).toBe("forked");
    expect(data.forkedFrom).toBe("src-pipe");
  });

  it("should fork a system pipeline (userId null)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const source = {
      ...mockPipelineRow({ id: asPipelineId("sys-pipe") }),
      userId: null,
    };
    const forked = mockPipelineRow({
      id: asPipelineId("my-fork"),
      name: "My Fork",
    });
    mocks.db.pipelineFindById.mockResolvedValue(source);
    mocks.db.pipelineCreate.mockResolvedValue(forked);

    const result = await pipelineSave(
      {
        pipeline_id: "sys-pipe",
        fork: true,
        name: "My Fork",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:created" }));
    expect(data.action).toBe("forked");
  });

  it("should return PIPELINE_NOT_FOUND when forking a private pipeline owned by another user", async () => {
    const ctx: ToolContext = { userId, deps };
    const source = mockPipelineRow({
      id: asPipelineId("private-pipe"),
      visibility: "PRIVATE",
      userId: "other-user",
    });
    mocks.db.pipelineFindById.mockResolvedValue(source);

    const result = await pipelineSave(
      {
        pipeline_id: "private-pipe",
        fork: true,
        name: "Copied",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_NOT_FOUND");
  });

  it("should return PIPELINE_NOT_FOUND when source does not exist for fork", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindById.mockResolvedValue(null);

    const result = await pipelineSave(
      {
        pipeline_id: "ghost-pipe",
        fork: true,
        name: "Ghost Fork",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_NOT_FOUND");
  });

  it("should update only description when name is unchanged", async () => {
    const ctx: ToolContext = { userId, deps };
    const existing = mockPipelineRow({
      id: asPipelineId("pipe-desc"),
      name: "Keep Name",
    });
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(existing);
    mocks.db.pipelineUpdate.mockResolvedValue({
      ...existing,
      description: "New description only",
    });

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-desc",
        name: "Keep Name",
        description: "New description only",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("updated");
    expect(mocks.db.pipelineUpdate).toHaveBeenCalledWith(
      "pipe-desc",
      expect.objectContaining({
        name: "Keep Name",
        description: "New description only",
      }),
    );
    // Verify no config keys are sent when configs not provided
    const updateArg = mocks.db.pipelineUpdate.mock.calls[0][1];
    expect(updateArg).not.toHaveProperty("analysisConfig");
    expect(updateArg).not.toHaveProperty("autoCropConfig");
    expect(updateArg).not.toHaveProperty("promptConfig");
    expect(updateArg).not.toHaveProperty("generationConfig");
  });

  it("should update pipeline with generation config", async () => {
    const ctx: ToolContext = { userId, deps };
    const existing = mockPipelineRow({
      id: asPipelineId("pipe-2"),
      name: "Gen Pipe",
    });
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(existing);
    const generationConfig = { model: "stable-diffusion" };
    mocks.db.pipelineUpdate.mockResolvedValue({
      ...existing,
      generationConfig,
    });

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-2",
        name: "Gen Pipe",
        configs: { generation: generationConfig },
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.pipelineUpdate).toHaveBeenCalledWith(
      "pipe-2",
      expect.objectContaining({ generationConfig }),
    );
  });

  it("should return FORK_FAILED when forked pipeline creation fails", async () => {
    const ctx: ToolContext = { userId, deps };
    const source = mockPipelineRow({
      visibility: "PUBLIC",
      userId: "other-user",
    });
    mocks.db.pipelineFindById.mockResolvedValue(source);
    mocks.db.pipelineCreate.mockRejectedValue(new Error("DB error"));

    const result = await pipelineSave(
      {
        pipeline_id: "src-pipe",
        fork: true,
        name: "Bad Fork",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FORK_FAILED");
  });

  it("should fork with default copy name when name is empty string", async () => {
    const ctx: ToolContext = { userId, deps };
    const source = mockPipelineRow({
      id: asPipelineId("src-pipe"),
      name: "Original Pipeline",
      visibility: "PUBLIC",
      userId: "other-user",
    });
    const forked = mockPipelineRow({
      id: asPipelineId("forked-copy"),
      name: "Original Pipeline (copy)",
    });
    mocks.db.pipelineFindById.mockResolvedValue(source);
    mocks.db.pipelineCreate.mockResolvedValue(forked);

    await pipelineSave(
      {
        pipeline_id: "src-pipe",
        fork: true,
        name: "",
      },
      ctx,
    );

    expect(mocks.db.pipelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Original Pipeline (copy)" }),
    );
  });

  it("should update pipeline with only description (no config changes)", async () => {
    const ctx: ToolContext = { userId, deps };
    const existing = mockPipelineRow({
      id: asPipelineId("pipe-partial"),
      name: "Partial Update",
    });
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(existing);
    mocks.db.pipelineUpdate.mockResolvedValue({
      ...existing,
      description: "Only desc changed",
    });

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-partial",
        name: "Partial Update",
        description: "Only desc changed",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const updateArg = mocks.db.pipelineUpdate.mock.calls[0][1];
    expect(updateArg).toHaveProperty("name", "Partial Update");
    expect(updateArg).toHaveProperty("description", "Only desc changed");
    expect(updateArg).not.toHaveProperty("analysisConfig");
  });

  it("should update pipeline with all config types at once", async () => {
    const ctx: ToolContext = { userId, deps };
    const existing = mockPipelineRow({
      id: asPipelineId("pipe-all"),
      name: "All Configs",
    });
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(existing);
    mocks.db.pipelineUpdate.mockResolvedValue({
      ...existing,
      name: "All Configs",
    });

    const result = await pipelineSave(
      {
        pipeline_id: "pipe-all",
        name: "All Configs",
        description: "Updated desc",
        configs: {
          analysis: { mode: "fast" },
          autoCrop: { enabled: true },
          prompt: { prefix: "Enhance:" },
          generation: { model: "stable" },
        },
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.pipelineUpdate).toHaveBeenCalledWith(
      "pipe-all",
      expect.objectContaining({
        name: "All Configs",
        description: "Updated desc",
        analysisConfig: { mode: "fast" },
        autoCropConfig: { enabled: true },
        promptConfig: { prefix: "Enhance:" },
        generationConfig: { model: "stable" },
      }),
    );
  });
});
