import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps } from "../__test-utils__/mock-deps.js";
import { subjectList } from "./subject-list.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";

describe("subjectList", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should list all registered subjects", async () => {
    const ctx: ToolContext = { userId, deps };
    const now = new Date("2025-01-01T00:00:00.000Z");
    mocks.db.subjectFindMany.mockResolvedValue([
      {
        id: "sub-1",
        userId,
        imageId: asImageId("img-1"),
        label: "Hero",
        type: "character",
        description: "The main hero",
        createdAt: now,
      },
      {
        id: "sub-2",
        userId,
        imageId: asImageId("img-2"),
        label: "Sword",
        type: "object",
        description: null,
        createdAt: now,
      },
    ]);

    const result = await subjectList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.subjects).toHaveLength(2);
    expect(data.subjects[0].id).toBe("sub-1");
    expect(data.subjects[0].label).toBe("Hero");
    expect(data.subjects[0].type).toBe("character");
    expect(data.subjects[0].description).toBe("The main hero");
    expect(data.subjects[0].created_at).toBe("2025-01-01T00:00:00.000Z");
  });

  it("should return empty list when no subjects exist", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([]);

    const result = await subjectList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.subjects).toHaveLength(0);
  });

  it("should return NOT_SUPPORTED when subjectFindMany is not available", async () => {
    const ctx: ToolContext = { userId, deps };
    (deps.db as Record<string, unknown>).subjectFindMany = undefined;

    const result = await subjectList({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
  });

  it("should return error when subjectFindMany fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockRejectedValue(new Error("DB error"));

    const result = await subjectList({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_LIST_FAILED");
  });

  it("should pass userId to subjectFindMany", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([]);

    await subjectList({}, ctx);

    expect(mocks.db.subjectFindMany).toHaveBeenCalledWith({ userId });
  });

  it("should return empty list when subjectFindMany returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue(null);

    const result = await subjectList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.subjects).toHaveLength(0);
  });

  it("should handle subjects with null description", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([
      {
        id: "sub-3",
        userId,
        imageId: asImageId("img-3"),
        label: "Artifact",
        type: "object",
        description: null,
        createdAt: new Date(),
      },
    ]);

    const result = await subjectList({}, ctx);

    const data = JSON.parse(result.content[0].text);
    expect(data.subjects[0].description).toBeNull();
  });
});
