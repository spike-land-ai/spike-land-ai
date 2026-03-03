import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { codegenTools } from "./codegen";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("codegen tools", () => {
  const registry = createMockRegistry(codegenTools);

  it("should create a bundle and build a prompt", async () => {
    const result = await registry.call("codegen_create_bundle", {
      spec: "Add hello world",
      file_contents: [],
    });
    const data = getJsonData<{ id: string; }>(result);
    const bundleId = data.id;

    const promptResult = await registry.call("codegen_build_prompt", {
      bundle_id: bundleId,
    });
    const promptData = getJsonData<{ prompt: string; }>(promptResult);
    expect(promptData.prompt).toContain("Specification: Add hello world");
  });

  it("should dispatch and parse output", async () => {
    const result = await registry.call("codegen_dispatch", { bundle_id: "b1" });
    const data = getJsonData<{ id: string; }>(result);
    const resultId = data.id;

    const parseResult = await registry.call("codegen_parse_output", {
      result_id: resultId,
    });
    expect(getText(parseResult)).toContain("Parsed 1 file(s)");
  });

  it("should get a result", async () => {
    const dispatchResult = await registry.call("codegen_dispatch", {
      bundle_id: "b2",
    });
    const dispatchData = getJsonData<{ id: string; }>(dispatchResult);

    const result = await registry.call("codegen_get_result", {
      result_id: dispatchData.id,
    });
    expect(getText(result)).toContain("Result details");
  });

  it("should error on missing result", async () => {
    const result = await registry.call("codegen_get_result", {
      result_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing bundle in build_prompt", async () => {
    const result = await registry.call("codegen_build_prompt", {
      bundle_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing result in parse_output", async () => {
    const result = await registry.call("codegen_parse_output", {
      result_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should retry with feedback", async () => {
    const bundleResult = await registry.call("codegen_create_bundle", {
      spec: "Retry test",
      file_contents: [{ path: "x.ts", content: "export const x = 1;" }],
    });
    const bundleData = getJsonData<{ id: string; }>(bundleResult);

    const dispatchResult = await registry.call("codegen_dispatch", {
      bundle_id: bundleData.id,
    });
    const dispatchData = getJsonData<{ id: string; }>(dispatchResult);

    const retryResult = await registry.call("codegen_retry", {
      result_id: dispatchData.id,
      feedback: "Add error handling",
    });
    expect(getText(retryResult)).toContain("Retry requested");
    const retryData = getJsonData<{ feedback: string; }>(retryResult);
    expect(retryData.feedback).toBe("Add error handling");
  });

  it("should error when bundle is missing for existing result in retry", async () => {
    // Dispatch with a non-existent bundle to create a result referencing a bad bundleId
    const badDispatch = await registry.call("codegen_dispatch", {
      bundle_id: "phantom-bundle",
    });
    const badData = getJsonData<{ id: string; }>(badDispatch);

    // Retry with the bad result - the result exists but its bundleId doesn't
    const retryResult = await registry.call("codegen_retry", {
      result_id: badData.id,
      feedback: "fix it",
    });
    expect(getText(retryResult)).toContain("not found");
  });

  it("should error on missing result in retry", async () => {
    const result = await registry.call("codegen_retry", {
      result_id: "nonexistent",
      feedback: "fix",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should summarize results", async () => {
    const d1 = await registry.call("codegen_dispatch", { bundle_id: "s1" });
    const d1Data = getJsonData<{ id: string; }>(d1);

    const result = await registry.call("codegen_summarize", {
      result_ids: [d1Data.id],
    });
    expect(getText(result)).toContain("Summary of 1 results");
  });

  it("should create bundle with optional fields", async () => {
    const result = await registry.call("codegen_create_bundle", {
      spec: "With extras",
      file_contents: [{ path: "y.ts", content: "y" }],
      conventions: ["use-strict"],
      constraints: ["no-loops"],
      examples: [{ description: "Example 1", code: "const a = 1;" }],
    });
    const data = getJsonData<{
      conventions: string[];
      constraints: string[];
      examples: Array<{ description: string; code: string; }>;
    }>(result);
    expect(data.conventions).toEqual(["use-strict"]);
    expect(data.constraints).toEqual(["no-loops"]);
    expect(data.examples).toHaveLength(1);
  });
});
