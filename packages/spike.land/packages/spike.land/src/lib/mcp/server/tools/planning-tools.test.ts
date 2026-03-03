import { describe, expect, it } from "vitest";

import { createMockRegistry } from "../__test-utils__";
import {
  getJsonData,
  getText,
} from "../__test-utils__/assertions";
import { architectTools } from "./planning-tools";

// ── Architect tools ──

describe("architect tools", () => {
  const registry = createMockRegistry(architectTools);

  it("should decompose a feature", async () => {
    const result = await registry.call("architect_decompose", {
      feature: "Add login page",
    });
    expect(getText(result)).toContain("Feature decomposed");
    const data = getJsonData<{ id: string; }>(result);
    const id = data.id;

    const planResult = await registry.call("architect_create_file_plan", {
      design_id: id,
    });
    expect(getText(planResult)).toContain("File plan created");
  });

  it("should design a component", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "x",
    });
    const decData = getJsonData<{ id: string; }>(decResult);
    const id = decData.id;

    const result = await registry.call("architect_design_component", {
      design_id: id,
      name: "UserCard",
      type: "component",
      description: "Shows user info",
    });
    expect(getText(result)).toContain("Component UserCard added");
  });

  it("should get a design", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "Get test",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    const result = await registry.call("architect_get_design", {
      design_id: decData.id,
    });
    expect(getText(result)).toContain("Design details");
  });

  it("should error on missing design in get_design", async () => {
    const result = await registry.call("architect_get_design", {
      design_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing design in create_file_plan", async () => {
    const result = await registry.call("architect_create_file_plan", {
      design_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should error on missing design in design_component", async () => {
    const result = await registry.call("architect_design_component", {
      design_id: "nonexistent",
      name: "X",
      type: "service",
      description: "test",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should decompose with context", async () => {
    const result = await registry.call("architect_decompose", {
      feature: "Auth flow",
      context: ["nextjs", "prisma"],
    });
    expect(getText(result)).toContain("Feature decomposed");
  });

  it("should design component with dependencies", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "deps test",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    const result = await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "Dashboard",
      type: "page",
      description: "Main dashboard",
      dependencies: ["UserCard", "StatsWidget"],
    });
    expect(getText(result)).toContain("Component Dashboard added");
    const data = getJsonData<{ dependencies: string[]; }>(result);
    expect(data.dependencies).toEqual(["UserCard", "StatsWidget"]);
  });

  it("should validate a design with no components", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "empty validate",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    const result = await registry.call("architect_validate_design", {
      design_id: decData.id,
    });
    const data = getJsonData<{ isValid: boolean; warnings: string[]; }>(result);
    expect(data.isValid).toBe(false);
    expect(data.warnings).toContain("Design has no components defined");
  });

  it("should validate a design with components successfully", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "valid design",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "Header",
      type: "component",
      description: "App header",
    });

    const result = await registry.call("architect_validate_design", {
      design_id: decData.id,
    });
    const data = getJsonData<
      { isValid: boolean; warnings: string[]; componentCount: number; }
    >(result);
    expect(data.isValid).toBe(true);
    expect(data.warnings).toHaveLength(0);
    expect(data.componentCount).toBe(1);
  });

  it("should detect circular dependencies in validate", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "circular",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "A",
      type: "service",
      description: "Service A",
      dependencies: ["B"],
    });
    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "B",
      type: "service",
      description: "Service B",
      dependencies: ["A"],
    });

    const result = await registry.call("architect_validate_design", {
      design_id: decData.id,
    });
    const data = getJsonData<{ isValid: boolean; warnings: string[]; }>(result);
    expect(data.isValid).toBe(false);
    expect(data.warnings.some((w: string) => w.includes("Circular dependency")))
      .toBe(true);
  });

  it("should validate design with shared dependencies (diamond graph)", async () => {
    const decResult = await registry.call("architect_decompose", {
      feature: "diamond",
    });
    const decData = getJsonData<{ id: string; }>(decResult);

    // A->C, B->C: diamond pattern, C visited from A's DFS, skipped for B
    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "A",
      type: "service",
      description: "Service A",
      dependencies: ["C"],
    });
    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "B",
      type: "service",
      description: "Service B",
      dependencies: ["C"],
    });
    await registry.call("architect_design_component", {
      design_id: decData.id,
      name: "C",
      type: "service",
      description: "Shared Service C",
    });

    const result = await registry.call("architect_validate_design", {
      design_id: decData.id,
    });
    const data = getJsonData<
      { isValid: boolean; warnings: string[]; componentCount: number; }
    >(result);
    expect(data.isValid).toBe(true);
    expect(data.warnings).toHaveLength(0);
    expect(data.componentCount).toBe(3);
  });

  it("should error on missing design in validate", async () => {
    const result = await registry.call("architect_validate_design", {
      design_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });
});
