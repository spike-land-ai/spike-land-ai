import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { diffTools } from "./diff";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("diff tools", () => {
  const registry = createMockRegistry(diffTools);

  it("should create and apply a changeset", async () => {
    const createResult = await registry.call("diff_create", {
      base_files: [{ path: "a.ts", content: "old" }],
      modified_files: [{ path: "a.ts", content: "new" }],
      description: "Update a",
    });
    const createData = getJsonData<{ id: string; }>(createResult);
    const id = createData.id;

    const applyResult = await registry.call("diff_apply", {
      changeset_id: id,
      target_files: [{ path: "a.ts", content: "old" }],
    });
    const applyData = getJsonData<Array<{ content: string; }>>(applyResult);
    expect(applyData[0]!.content).toBe("new");
  });

  it("should parse a unified diff", async () => {
    const result = await registry.call("diff_parse", {
      unified_diff: "+++ b.ts\n@@ -1,1 +1,1 @@\n-x\n+y",
    });
    expect(getText(result)).toContain("Parsed 1 file(s)");
  });

  it("should validate a changeset", async () => {
    const createResult = await registry.call("diff_create", {
      base_files: [{ path: "b.ts", content: "a" }],
      modified_files: [{ path: "b.ts", content: "b" }],
      description: "Validate test",
    });
    const createData = getJsonData<{ id: string; }>(createResult);

    const result = await registry.call("diff_validate", {
      changeset_id: createData.id,
    });
    expect(getText(result)).toContain("is valid");
  });

  it("should merge changesets", async () => {
    const result = await registry.call("diff_merge", {
      changeset_ids: ["cs1", "cs2"],
    });
    expect(getText(result)).toContain("Merge");
    const data = getJsonData<{ id: string; status: string; }>(result);
    expect(data.status).toBe("merged");
  });

  it("should resolve a merge conflict", async () => {
    const mergeResult = await registry.call("diff_merge", {
      changeset_ids: ["cs1"],
    });
    const mergeData = getJsonData<{ id: string; }>(mergeResult);

    const result = await registry.call("diff_resolve", {
      merge_id: mergeData.id,
      path: "file.ts",
      manual_content: "resolved content",
    });
    expect(getText(result)).toContain("Conflict resolved");
  });

  it("should get a changeset", async () => {
    const createResult = await registry.call("diff_create", {
      base_files: [{ path: "c.ts", content: "x" }],
      modified_files: [{ path: "c.ts", content: "y" }],
      description: "Get test",
    });
    const createData = getJsonData<{ id: string; }>(createResult);

    const result = await registry.call("diff_get_changeset", {
      changeset_id: createData.id,
    });
    expect(getText(result)).toContain("Changeset");
  });

  it("should summarize changesets", async () => {
    const c1 = await registry.call("diff_create", {
      base_files: [{ path: "d.ts", content: "1" }],
      modified_files: [{ path: "d.ts", content: "2" }],
      description: "First",
    });
    const c1Data = getJsonData<{ id: string; }>(c1);

    const result = await registry.call("diff_summarize", {
      changeset_ids: [c1Data.id],
    });
    expect(getText(result)).toContain("Summary of 1 changesets");
  });

  it("should error on missing changeset in validate", async () => {
    const result = await registry.call("diff_validate", {
      changeset_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing changeset in apply", async () => {
    const result = await registry.call("diff_apply", {
      changeset_id: "nonexistent",
      target_files: [{ path: "x.ts", content: "x" }],
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing changeset in get_changeset", async () => {
    const result = await registry.call("diff_get_changeset", {
      changeset_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing merge in resolve", async () => {
    const result = await registry.call("diff_resolve", {
      merge_id: "nonexistent",
      path: "x.ts",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should resolve merge conflict with manual_content when file exists", async () => {
    // Create a merge that has files
    const mergeResult = await registry.call("diff_merge", {
      changeset_ids: ["cs1"],
    });
    const mergeData = getJsonData<
      { id: string; files: Array<{ path: string; content: string; }>; }
    >(mergeResult);

    // Manually add a file to the merge result so the resolve actually modifies it
    mergeData.files.push({ path: "conflict.ts", content: "original content" });

    const result = await registry.call("diff_resolve", {
      merge_id: mergeData.id,
      path: "conflict.ts",
      manual_content: "resolved content",
    });
    expect(getText(result)).toContain("Conflict resolved");
  });

  it("should resolve merge without manual_content (no-op)", async () => {
    const mergeResult = await registry.call("diff_merge", {
      changeset_ids: ["cs1"],
    });
    const mergeData = getJsonData<{ id: string; }>(mergeResult);

    const result = await registry.call("diff_resolve", {
      merge_id: mergeData.id,
      path: "file.ts",
    });
    expect(getText(result)).toContain("Conflict resolved");
  });

  it("should apply changeset with unmatched file path", async () => {
    const createResult = await registry.call("diff_create", {
      base_files: [{ path: "e.ts", content: "old" }],
      modified_files: [{ path: "e.ts", content: "new" }],
      description: "Unmatched",
    });
    const createData = getJsonData<{ id: string; }>(createResult);

    const applyResult = await registry.call("diff_apply", {
      changeset_id: createData.id,
      target_files: [{ path: "other.ts", content: "untouched" }],
    });
    const applyData = getJsonData<Array<{ path: string; content: string; }>>(
      applyResult,
    );
    expect(applyData[0]!.content).toBe("untouched");
  });
});
