import { describe, it, expect } from "vitest";
import { parseMdContent, generateSQL, escapeSQL } from "../seed-apps-lib";

describe("seed-apps-lib", () => {
  describe("escapeSQL", () => {
    it("escapes single quotes", () => {
      expect(escapeSQL("It's a test")).toBe("It''s a test");
    });
  });

  describe("parseMdContent", () => {
    it("parses valid app markdown", () => {
      const raw = `---
slug: "test-app"
name: "Test App"
description: "A test app"
emoji: "🧪"
status: "live"
category: "Media & Creative"
tags:
  - "pages"
  - "templates"
tagline: "A polished template picker"
pricing: "free"
is_featured: true
is_new: true
sort_order: 1
tools:
  - "tool_1"
graph:
  tool_1:
    inputs: {}
    outputs: {}
    always_available: true
---
# Hello World
<ToolRun name="tool_1" />`;

      const app = parseMdContent(raw, "test-app.md");
      expect(app).not.toBeNull();
      expect(app?.slug).toBe("test-app");
      expect(app?.name).toBe("Test App");
      expect(app?.category).toBe("Media & Creative");
      expect(app?.tags).toEqual(["pages", "templates"]);
      expect(app?.tagline).toBe("A polished template picker");
      expect(app?.is_featured).toBe(true);
      expect(app?.is_new).toBe(true);
      expect(app?.tools).toEqual(["tool_1"]);
      expect(app?.tool_count).toBe(1);
      expect(app?.markdown).toContain("# Hello World");
    });
  });

  describe("generateSQL", () => {
    it("generates correct SQL", () => {
      const sql = generateSQL([
        {
          slug: "app1",
          name: "App 1",
          description: "Desc",
          emoji: "🚀",
          category: "Code & Developer Tools",
          tags: ["code", "developer"],
          tagline: "Build faster",
          pricing: "free",
          is_featured: true,
          is_new: false,
          status: "live",
          tools: ["t1"],
          graph: { t1: {} },
          markdown: "body",
          tool_count: 1,
          sort_order: 1,
        },
      ]);
      expect(sql).toContain("INSERT OR REPLACE INTO mcp_apps");
      expect(sql).toContain("'app1'");
      expect(sql).toContain("'App 1'");
      expect(sql).toContain("'[\"t1\"]'");
      expect(sql).toContain("'Code & Developer Tools'");
      expect(sql).toContain("'[\"code\",\"developer\"]'");
      expect(sql).toContain("'Build faster'");
      expect(sql).toContain("'free'");
    });
  });
});
