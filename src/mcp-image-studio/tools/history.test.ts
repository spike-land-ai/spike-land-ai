import { asJobId } from "../types.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockJobRow } from "../__test-utils__/mock-deps.js";
import { history } from "./history.js";
import type { ToolCallRow, ToolContext } from "../types.js";

function mockToolCallRow(overrides: Partial<ToolCallRow> = {}): ToolCallRow {
  return {
    id: "tc-1",
    userId: "u1",
    toolName: "img_generate",
    args: "{}",
    durationMs: 500,
    isError: false,
    status: "COMPLETED",
    result: null,
    createdAt: new Date("2026-02-20T12:00:00Z"),
    updatedAt: new Date("2026-02-20T12:00:00Z"),
    ...overrides,
  };
}

describe("history", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  // ── Happy path: list all (enhancement + generation via toolCallList) ──

  it("should list both enhancement and generation jobs when type is all", async () => {
    const ctx: ToolContext = { userId, deps };
    const enhJob = mockJobRow({
      id: asJobId("enh-1"),
      userId,
      status: "COMPLETED",
      createdAt: new Date("2026-02-20T10:00:00Z"),
    });
    mocks.db.jobFindMany.mockResolvedValue([enhJob]);

    const toolCall = mockToolCallRow({
      id: "tc-gen",
      toolName: "img_generate",
      status: "COMPLETED",
      createdAt: new Date("2026-02-20T11:00:00Z"),
    });
    (deps.db as Record<string, unknown>).toolCallList = vi.fn().mockResolvedValue([toolCall]);

    const result = await history({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(2);
    expect(data.type).toBe("all");
    // Should be sorted descending by createdAt
    expect(data.jobs[0].type).toBe("generation");
    expect(data.jobs[1].type).toBe("enhancement");
  });

  // ── Happy path: enhancement only ──

  it("should list only enhancement jobs when type is enhancement", async () => {
    const ctx: ToolContext = { userId, deps };
    const enhJob = mockJobRow({
      id: asJobId("enh-2"),
      userId,
      status: "PENDING",
    });
    mocks.db.jobFindMany.mockResolvedValue([enhJob]);

    const result = await history({ type: "enhancement" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].type).toBe("enhancement");
    expect(data.jobs[0].id).toBe("enh-2");
    expect(data.type).toBe("enhancement");
  });

  // ── Happy path: generation only (with toolCallList available) ──

  it("should list only generation jobs when type is generation and toolCallList exists", async () => {
    const ctx: ToolContext = { userId, deps };
    const genCall = mockToolCallRow({ id: "tc-1", toolName: "img_generate" });
    const editCall = mockToolCallRow({ id: "tc-2", toolName: "img_edit" });
    const otherCall = mockToolCallRow({ id: "tc-3", toolName: "img_list" });
    (deps.db as Record<string, unknown>).toolCallList = vi
      .fn()
      .mockResolvedValue([genCall, editCall, otherCall]);

    const result = await history({ type: "generation" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    // Only img_generate and img_edit should appear, not img_list
    expect(data.jobs).toHaveLength(2);
    expect(data.jobs.every((j: Record<string, unknown>) => j.type === "generation")).toBe(true);
    expect(data.type).toBe("generation");
  });

  // ── Happy path: generation only (without toolCallList — returns empty) ──

  it("should return empty generation list when toolCallList is not available", async () => {
    const ctx: ToolContext = { userId, deps };
    // toolCallList is undefined by default in mock deps

    const result = await history({ type: "generation" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(0);
    expect(data.total).toBe(0);
    expect(data.type).toBe("generation");
  });

  // ── Happy path: with status filter ──

  it("should pass status filter to jobFindMany", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);

    await history({ status: "FAILED" }, ctx);

    expect(mocks.db.jobFindMany).toHaveBeenCalledWith({
      userId,
      status: "FAILED",
      limit: 20,
    });
  });

  // ── Happy path: with custom limit ──

  it("should respect custom limit", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);

    await history({ limit: 5 }, ctx);

    expect(mocks.db.jobFindMany).toHaveBeenCalledWith({
      userId,
      status: undefined,
      limit: 5,
    });
  });

  // ── Happy path: limit capped at 100 ──

  it("should return INVALID_INPUT when limit exceeds max", async () => {
    const ctx: ToolContext = { userId, deps };
    const result = await history({ limit: 500 }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  // ── Error: jobFindMany fails ──

  it("should return HISTORY_FAILED when jobFindMany throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockRejectedValue(new Error("DB connection lost"));

    const result = await history({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HISTORY_FAILED");
    expect(result.content[0].text).toContain("DB connection lost");
  });

  it("should skip enhancement results when jobFindMany resolves to null (ok but no data)", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue(null);

    const result = await history({ type: "enhancement" }, ctx);

    // enhRes.ok is true but enhRes.data is null/falsy
    // Falls through to neither branch — no entries and no error
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(0);
  });

  it("should return HISTORY_FAILED when jobFindMany rejects for enhancement type", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockRejectedValue(new Error("Enhancement query failed"));

    const result = await history({ type: "enhancement" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("HISTORY_FAILED");
    expect(result.content[0].text).toContain("Enhancement query failed");
  });

  it("should gracefully handle toolCallList rejection", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);
    (deps.db as Record<string, unknown>).toolCallList = vi
      .fn()
      .mockRejectedValue(new Error("toolCallList failed"));

    const result = await history({ type: "all" }, ctx);

    // toolCallList failure is silently ignored (best-effort)
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(0);
  });

  it("should handle null data from toolCallList gracefully", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);
    (deps.db as Record<string, unknown>).toolCallList = vi.fn().mockResolvedValue(null);

    const result = await history({ type: "generation" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobs).toHaveLength(0);
  });

  // ── ToolCallRow status mapping ──

  it("should map ERROR status to FAILED and PENDING status to PENDING", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);
    (deps.db as Record<string, unknown>).toolCallList = vi.fn().mockResolvedValue([
      mockToolCallRow({
        id: "tc-err",
        status: "ERROR",
        toolName: "img_generate",
      }),
      mockToolCallRow({
        id: "tc-pend",
        status: "PENDING",
        toolName: "img_edit",
      }),
    ]);

    const result = await history({ type: "all" }, ctx);

    const data = JSON.parse(result.content[0].text);
    const errJob = data.jobs.find((j: Record<string, unknown>) => j.id === "tc-err");
    const pendJob = data.jobs.find((j: Record<string, unknown>) => j.id === "tc-pend");
    expect(errJob.status).toBe("FAILED");
    expect(pendJob.status).toBe("PENDING");
  });
});
