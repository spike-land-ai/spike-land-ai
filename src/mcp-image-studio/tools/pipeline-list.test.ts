import { asPipelineId } from "../types.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockPipelineRow } from "../__test-utils__/mock-deps.js";
import { pipelineList } from "./pipeline-list.js";
import type { ToolContext } from "../types.js";

describe("pipelineList", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should list pipelines", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindMany.mockResolvedValue([
      mockPipelineRow({ id: asPipelineId("p1"), name: "P1", userId }),
    ]);

    const result = await pipelineList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.pipelines).toHaveLength(1);
  });

  it("should return error if database fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindMany.mockRejectedValue(new Error("DB offline"));

    const result = await pipelineList({}, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LIST_PIPELINES_FAILED");
  });

  it("should pass custom limit parameter to database", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindMany.mockResolvedValue([mockPipelineRow({ userId })]);

    const result = await pipelineList({ limit: 10 }, ctx);

    expect(result.isError).toBeUndefined();
    expect(mocks.db.pipelineFindMany).toHaveBeenCalledWith({
      userId,
      limit: 10,
    });
  });

  it("should return empty list when DB returns no pipelines", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindMany.mockResolvedValue([]);

    const result = await pipelineList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.pipelines).toHaveLength(0);
    expect(data.count).toBe(0);
  });

  it("should return empty list when DB returns null data", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.pipelineFindMany.mockResolvedValue(null);

    const result = await pipelineList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.pipelines).toHaveLength(0);
    expect(data.count).toBe(0);
  });
});
