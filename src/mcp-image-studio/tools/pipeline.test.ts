import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockPipelineRow } from "../__test-utils__/mock-deps.js";
import { pipeline } from "./pipeline.js";
import type { ToolContext } from "../types.js";
import { asPipelineId } from "../types.js";

describe("pipeline", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should fetch an owned pipeline", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = mockPipelineRow({
      id: asPipelineId("pipe-1"),
      userId,
      visibility: "PRIVATE",
    });
    mocks.db.pipelineFindById.mockResolvedValue(row);

    const result = await pipeline({ pipeline_id: "pipe-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("pipe-1");
  });

  it("should allow access to a system pipeline (userId=null)", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = mockPipelineRow({
      id: asPipelineId("sys-pipe"),
      userId: null,
      visibility: "PRIVATE",
    });
    mocks.db.pipelineFindById.mockResolvedValue(row);

    const result = await pipeline({ pipeline_id: "sys-pipe" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("sys-pipe");
    expect(data.userId).toBeNull();
  });

  it("should allow access to a public pipeline owned by another user", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = mockPipelineRow({
      id: asPipelineId("pub-pipe"),
      userId: "other-user",
      visibility: "PUBLIC",
    });
    mocks.db.pipelineFindById.mockResolvedValue(row);

    const result = await pipeline({ pipeline_id: "pub-pipe" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("pub-pipe");
  });

  it("should return error for a private pipeline owned by another user", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = mockPipelineRow({
      id: asPipelineId("priv-pipe"),
      userId: "other-user",
      visibility: "PRIVATE",
    });
    mocks.db.pipelineFindById.mockResolvedValue(row);

    const result = await pipeline({ pipeline_id: "priv-pipe" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_NOT_FOUND");
  });

  it("should return error when pipeline is not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindById.mockResolvedValue(null);

    const result = await pipeline({ pipeline_id: "nonexistent" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_NOT_FOUND");
  });

  it("should return error when database call fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindById.mockRejectedValue(new Error("DB offline"));

    const result = await pipeline({ pipeline_id: "pipe-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("PIPELINE_NOT_FOUND");
  });
});
