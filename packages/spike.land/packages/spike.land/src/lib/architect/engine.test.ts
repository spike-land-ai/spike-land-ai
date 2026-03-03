import { describe, expect, it } from "vitest";
import {
  buildDependencyGraph,
  createFilePlan,
  decomposeFeature,
} from "./engine";

describe("architect engine", () => {
  it("should decompose a feature", () => {
    const design = decomposeFeature("Add a new blog page", []);
    expect(design.feature).toBe("Add a new blog page");
    expect(design.components.length).toBeGreaterThan(0);
    expect(design.components[0]!.type).toBe("page");
  });

  it("should build a dependency graph", () => {
    const files = [
      { path: "a.ts", imports: ["b.ts"] },
      { path: "b.ts", imports: [] },
    ];
    const graph = buildDependencyGraph(files);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.from).toBe("a.ts");
    expect(graph.edges[0]!.to).toBe("b.ts");
  });

  it("should create a file plan", () => {
    const design = decomposeFeature("page", []);
    const plan = createFilePlan(design);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan[0]!.action).toBe("create");
  });
});
