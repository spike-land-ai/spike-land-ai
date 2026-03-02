import { describe, expect, it } from "vitest";
import { allTools, WRITE_TOOL_NAMES } from "./definitions";

describe("MCP tool definitions", () => {
  it("should export 7 tools", () => {
    expect(allTools).toHaveLength(7);
  });

  it("should have unique tool names", () => {
    const names = allTools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should include all expected tools", () => {
    const names = allTools.map((t) => t.name);
    expect(names).toContain("read_code");
    expect(names).toContain("read_html");
    expect(names).toContain("read_session");
    expect(names).toContain("update_code");
    expect(names).toContain("edit_code");
    expect(names).toContain("search_and_replace");
    expect(names).toContain("find_lines");
  });

  it("should have description and inputSchema for each tool", () => {
    for (const tool of allTools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it("should have required fields for write tools", () => {
    const updateCode = allTools.find((t) => t.name === "update_code")!;
    expect(updateCode.inputSchema.required).toContain("codeSpace");
    expect(updateCode.inputSchema.required).toContain("code");

    const editCode = allTools.find((t) => t.name === "edit_code")!;
    expect(editCode.inputSchema.required).toContain("codeSpace");
    expect(editCode.inputSchema.required).toContain("edits");
  });

  describe("WRITE_TOOL_NAMES", () => {
    it("should contain exactly the write tools", () => {
      expect(WRITE_TOOL_NAMES.size).toBe(3);
      expect(WRITE_TOOL_NAMES.has("update_code")).toBe(true);
      expect(WRITE_TOOL_NAMES.has("edit_code")).toBe(true);
      expect(WRITE_TOOL_NAMES.has("search_and_replace")).toBe(true);
    });

    it("should not contain read tools", () => {
      expect(WRITE_TOOL_NAMES.has("read_code")).toBe(false);
      expect(WRITE_TOOL_NAMES.has("read_html")).toBe(false);
      expect(WRITE_TOOL_NAMES.has("read_session")).toBe(false);
      expect(WRITE_TOOL_NAMES.has("find_lines")).toBe(false);
    });
  });
});
