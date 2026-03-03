import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { testgenTools } from "./testgen";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("testgen tools", () => {
  const registry = createMockRegistry(testgenTools);

  it("should generate a suite from spec", async () => {
    const result = await registry.call("testgen_from_spec", {
      spec: "Test login",
      target_path: "login.test.ts",
    });
    expect(getText(result)).toContain("Test suite generated");
    const data = getJsonData<{ testCode: string; }>(result);
    expect(data.testCode).toContain("Test login");
  });

  it("should create and apply a pattern", async () => {
    const createResult = await registry.call("testgen_create_pattern", {
      name: "P1",
      template: "test {{val}}",
      framework: "vitest",
      variables: ["val"],
    });
    const createData = getJsonData<{ id: string; }>(createResult);
    const id = createData.id;

    const applyResult = await registry.call("testgen_apply_pattern", {
      pattern_id: id,
      variables: { val: "x" },
      target_path: "out.ts",
    });
    const applyData = getJsonData<{ testCode: string; }>(applyResult);
    expect(applyData.testCode).toBe("test x");
  });

  it("should generate a suite from code", async () => {
    const result = await registry.call("testgen_from_code", {
      source_code: "export function add(a: number, b: number) { return a + b; }",
      target_path: "add.test.ts",
    });
    expect(getText(result)).toContain("Test suite generated from code");
    const data = getJsonData<{ testCode: string; targetPath: string; }>(result);
    expect(data.targetPath).toBe("add.test.ts");
  });

  it("should get a suite", async () => {
    const createResult = await registry.call("testgen_from_spec", {
      spec: "Get suite test",
      target_path: "get.test.ts",
    });
    const createData = getJsonData<{ id: string; }>(createResult);

    const result = await registry.call("testgen_get_suite", {
      suite_id: createData.id,
    });
    expect(getText(result)).toContain("Suite details");
  });

  it("should error on missing suite", async () => {
    const result = await registry.call("testgen_get_suite", {
      suite_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should validate a suite", async () => {
    const createResult = await registry.call("testgen_from_spec", {
      spec: "Validate test",
      target_path: "validate.test.ts",
    });
    const createData = getJsonData<{ id: string; }>(createResult);

    const result = await registry.call("testgen_validate_suite", {
      suite_id: createData.id,
    });
    expect(getText(result)).toContain("is valid");
  });

  it("should error on missing suite in validate", async () => {
    const result = await registry.call("testgen_validate_suite", {
      suite_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing pattern in apply", async () => {
    const result = await registry.call("testgen_apply_pattern", {
      pattern_id: "nonexistent",
      variables: { x: "y" },
      target_path: "z.ts",
    });
    expect(getText(result)).toContain("not found");
  });
});
