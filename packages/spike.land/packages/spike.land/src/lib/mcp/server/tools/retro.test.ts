import { describe, expect, it } from "vitest";
import { createMockRegistry } from "../__test-utils__/mock-registry";
import { retroTools } from "./retro";
import { getJsonData, getText } from "../__test-utils__/assertions";

describe("retro tools", () => {
  const registry = createMockRegistry(retroTools);

  it("should analyze a session", async () => {
    const result = await registry.call("retro_analyze", { session_id: "s1" });
    expect(getText(result)).toContain("Retrospective completed");
    const data = getJsonData<{ patterns: unknown; }>(result);
    expect(data.patterns).toBeDefined();
  });

  it("should add and search knowledge", async () => {
    await registry.call("retro_add_knowledge", {
      category: "test",
      title: "How to test",
      content: "Use vitest",
      tags: ["test"],
    });

    const result = await registry.call("retro_search_knowledge", {
      query: "vitest",
    });
    expect(getText(result)).toContain("Found 1 item(s)");
  });

  it("should provide recommendations", async () => {
    const result = await registry.call("retro_get_recommendations", {
      project_type: "nextjs",
    });
    expect(getText(result)).toContain("General recommendations");
  });

  it("should default project_type to nextjs when not provided", async () => {
    const result = await registry.call("retro_get_recommendations", {});
    expect(getText(result)).toContain("General recommendations for nextjs");
  });

  it("should get a retro by ID", async () => {
    const analyzeResult = await registry.call("retro_analyze", {
      session_id: "s2",
    });
    const analyzeData = getJsonData<{ id: string; }>(analyzeResult);

    const result = await registry.call("retro_get", {
      retro_id: analyzeData.id,
    });
    expect(getText(result)).toContain("Retro");
  });

  it("should error on missing retro", async () => {
    const result = await registry.call("retro_get", {
      retro_id: "nonexistent",
    });
    expect(getText(result)).toContain("not found");
  });

  it("should compare sessions", async () => {
    const result = await registry.call("retro_compare_sessions", {
      session_ids: ["s1", "s2", "s3"],
    });
    expect(getText(result)).toContain("Comparison of 3 sessions");
  });

  it("should search knowledge with category filter", async () => {
    await registry.call("retro_add_knowledge", {
      category: "patterns",
      title: "Factory Pattern",
      content: "Use factory for creating objects",
    });

    const result = await registry.call("retro_search_knowledge", {
      query: "factory",
      category: "patterns",
    });
    expect(getText(result)).toContain("Found 1 item(s)");
  });

  it("should return empty results for non-matching search", async () => {
    const result = await registry.call("retro_search_knowledge", {
      query: "zzzznonexistent",
    });
    expect(getText(result)).toContain("Found 0 item(s)");
  });
});
