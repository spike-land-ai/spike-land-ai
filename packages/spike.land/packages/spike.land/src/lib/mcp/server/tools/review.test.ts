// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { reviewTools } from "./review";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("review tools", () => {
  const registry = createMockRegistry(reviewTools);

  it("should check conventions", async () => {
    const result = await registry.call("review_code", {
      files: [{ path: "test.ts", content: "console.log(x);" }],
    });
    expect(getText(result)).toContain("Review complete");
    const data = JSON.parse((result.content[1] as { text: string; }).text);
    expect(data.findings).toHaveLength(2);
  });

  it("should analyze complexity", async () => {
    const result = await registry.call("review_analyze_complexity", {
      files: [{ path: "long.ts", content: "\n".repeat(301) }],
    });
    expect(getText(result)).toContain("Complexity analysis complete");
  });

  it("should create and retrieve a convention set", async () => {
    const createResult = await registry.call("review_create_conventions", {
      name: "MyRules",
      rules: [
        {
          id: "r1",
          name: "no-eval",
          description: "Disallow eval",
          pattern: "eval\\(",
          severity: "error",
          message: "Do not use eval",
        },
      ],
    });
    expect(getText(createResult)).toContain("Convention set MyRules created");
    const createData = getJsonData<{ id: string; }>(createResult);

    const getResult = await registry.call("review_get_conventions", {
      convention_id: createData.id,
    });
    expect(getText(getResult)).toContain("Convention set");
  });

  it("should list conventions", async () => {
    const result = await registry.call("review_list_conventions", {});
    expect(getText(result)).toContain("convention set(s)");
  });

  it("should get built-in rules", async () => {
    const result = await registry.call("review_get_built_in_rules", {});
    expect(getText(result)).toContain("built-in rule(s)");
  });

  it("should get a report after review", async () => {
    const reviewResult = await registry.call("review_code", {
      files: [{ path: "a.ts", content: "let x = 1;" }],
    });
    const reviewData = getJsonData<{ id: string; }>(reviewResult);

    const getResult = await registry.call("review_get_report", {
      report_id: reviewData.id,
    });
    expect(getText(getResult)).toContain("Review Report");
  });

  it("should estimate effort from a report", async () => {
    const reviewResult = await registry.call("review_code", {
      files: [{ path: "b.ts", content: "let x = 1;" }],
    });
    const reviewData = getJsonData<{ id: string; }>(reviewResult);

    const result = await registry.call("review_estimate_effort", {
      report_id: reviewData.id,
    });
    expect(getText(result)).toContain("Estimated refactoring effort");
    const data = getJsonData<{ hours: number; difficulty: string; }>(result);
    expect(data.difficulty).toBeDefined();
  });

  it("should review code with a custom convention set", async () => {
    const convResult = await registry.call("review_create_conventions", {
      name: "Custom",
      rules: [
        {
          id: "c1",
          name: "no-var",
          description: "No var",
          pattern: "\\bvar\\b",
          severity: "warning",
          message: "Use let/const",
        },
      ],
    });
    const convData = getJsonData<{ id: string; }>(convResult);

    const result = await registry.call("review_code", {
      files: [{ path: "c.ts", content: "var x = 1;" }],
      convention_set_id: convData.id,
    });
    expect(getText(result)).toContain("Review complete");
  });

  it("should get project rules", async () => {
    const result = await registry.call("review_project_rules", {
      project_type: "nextjs",
    });
    expect(getText(result)).toContain("Built-in rules for nextjs");
  });

  it("should error on missing report", async () => {
    const result = await registry.call("review_get_report", {
      report_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing convention set in review_code", async () => {
    const result = await registry.call("review_code", {
      files: [{ path: "x.ts", content: "x" }],
      convention_set_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing convention set in get_conventions", async () => {
    const result = await registry.call("review_get_conventions", {
      convention_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should estimate medium difficulty for moderate findings", async () => {
    // Need > 8 findings to get > 4 hours (findings * 0.5), which gives "medium"
    // console.log has pattern match, so we need files that generate many findings
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `file${i}.ts`,
      content: "console.log(x);",
    }));
    const reviewResult = await registry.call("review_code", { files });
    const reviewData = getJsonData<{ id: string; }>(reviewResult);

    const result = await registry.call("review_estimate_effort", {
      report_id: reviewData.id,
    });
    const data = getJsonData<{ hours: number; difficulty: string; }>(result);
    expect(data.difficulty).toBe("medium");
  });

  it("should error on missing report in estimate_effort", async () => {
    const result = await registry.call("review_estimate_effort", {
      report_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });
});
