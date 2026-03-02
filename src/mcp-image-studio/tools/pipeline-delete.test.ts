import { asPipelineId } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockPipelineRow } from "../__test-utils__/mock-deps.js";
import { pipelineDelete } from "./pipeline-delete.js";
import type { ToolContext } from "../types.js";

describe("pipelineDelete", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should delete an owned pipeline", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(
      mockPipelineRow({ id: asPipelineId("p1"), userId }),
    );
    mocks.db.pipelineFindById.mockResolvedValue({ id: "p1", _count: { albums: 0 } } as never);
    mocks.db.pipelineDelete.mockResolvedValue(true);

    const result = await pipelineDelete({ pipeline_id: "p1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:deleted" }));
    expect(data.deleted).toBe(true);
  });

  it("should return error if pipeline not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(null);

    const result = await pipelineDelete({ pipeline_id: "missing" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should return error if pipeline is in use", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(mockPipelineRow({ userId }));
    mocks.db.pipelineFindById.mockResolvedValue({ id: "p1", _count: { albums: 5 } } as never);

    const result = await pipelineDelete({ pipeline_id: "p1" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_IN_USE");
  });

  it("should return DELETE_FAILED when pipelineDelete throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(
      mockPipelineRow({ id: asPipelineId("p1"), userId }),
    );
    mocks.db.pipelineFindById.mockResolvedValue({ id: "p1", _count: { albums: 0 } } as never);
    mocks.db.pipelineDelete.mockRejectedValue(new Error("DB delete error"));

    const result = await pipelineDelete({ pipeline_id: "p1" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DELETE_FAILED");
  });

  it("should proceed to delete when pipelineFindById throws during usage count check", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolvePipeline.mockResolvedValue(
      mockPipelineRow({ id: asPipelineId("p1"), userId }),
    );
    mocks.db.pipelineFindById.mockRejectedValue(new Error("DB read error"));
    mocks.db.pipelineDelete.mockResolvedValue(true);

    // When pipelineFindById throws, tryCatch returns { ok: false },
    // so the PIPELINE_IN_USE check is skipped and deletion proceeds
    const result = await pipelineDelete({ pipeline_id: "p1" }, ctx);
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "pipeline:deleted" }));
    expect(data.deleted).toBe(true);
  });
});
