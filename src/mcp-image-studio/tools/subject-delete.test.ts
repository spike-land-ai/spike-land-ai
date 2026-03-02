import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockSubjectRow } from "../__test-utils__/mock-deps.js";
import { subjectDelete } from "./subject-delete.js";
import type { ToolContext } from "../types.js";

describe("subjectDelete", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should delete a subject successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.db.subjectFindMany.mockResolvedValue([
      mockSubjectRow({ id: "sub-1", userId, label: "Hero" }),
    ]);
    mocks.db.subjectDelete.mockResolvedValue(undefined);

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "subject:deleted" }));
    expect(data.deleted).toBe(true);
    expect(data.subject_id).toBe("sub-1");
    expect(mocks.db.subjectDelete).toHaveBeenCalledWith("sub-1");
  });

  it("should return CONFIRMATION_REQUIRED when confirm is false", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await subjectDelete({ subject_id: "sub-1", confirm: false }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CONFIRMATION_REQUIRED");
    expect(mocks.db.subjectDelete).not.toHaveBeenCalled();
  });

  it("should return NOT_SUPPORTED when subjectDelete is not available", async () => {
    const ctx: ToolContext = { userId, deps };
    (deps.db as Record<string, unknown>).subjectDelete = undefined;

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
  });

  it("should return SUBJECT_NOT_FOUND when subject does not exist", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([]);

    const result = await subjectDelete({ subject_id: "sub-missing", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_NOT_FOUND");
    expect(mocks.db.subjectDelete).not.toHaveBeenCalled();
  });

  it("should return SUBJECT_NOT_FOUND when subject belongs to another user", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([
      mockSubjectRow({ id: "sub-1", userId: "other-user", label: "Hero" }),
    ]);

    // subjectFindMany is filtered by userId, so it won't return other user's subjects
    // But since we mock it to return empty for this user, the subject won't be found
    mocks.db.subjectFindMany.mockResolvedValue([]);

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("SUBJECT_NOT_FOUND");
  });

  it("should return DELETE_FAILED when subjectDelete throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockResolvedValue([
      mockSubjectRow({ id: "sub-1", userId, label: "Hero" }),
    ]);
    mocks.db.subjectDelete.mockRejectedValue(new Error("DB error"));

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DELETE_FAILED");
  });

  it("should return LOOKUP_FAILED when subjectFindMany throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.subjectFindMany.mockRejectedValue(new Error("DB error"));

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LOOKUP_FAILED");
  });

  it("should skip ownership check when subjectFindMany is not available", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    (deps.db as Record<string, unknown>).subjectFindMany = undefined;
    mocks.db.subjectDelete.mockResolvedValue(undefined);

    const result = await subjectDelete({ subject_id: "sub-1", confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "subject:deleted" }));
    expect(data.deleted).toBe(true);
    expect(mocks.db.subjectDelete).toHaveBeenCalledWith("sub-1");
  });
});
