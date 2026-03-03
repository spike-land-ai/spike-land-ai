import { describe, expect, it } from "vitest";
import { getToolRenderer } from "@/components/chat/tool-renderers/registry";
import { DefaultToolRenderer } from "@/components/chat/tool-renderers/DefaultToolRenderer";
import { CodeToolRenderer } from "@/components/chat/tool-renderers/CodeToolRenderer";
import { SearchToolRenderer } from "@/components/chat/tool-renderers/SearchToolRenderer";
import { FileToolRenderer } from "@/components/chat/tool-renderers/FileToolRenderer";

describe("tool renderer registry", () => {
  it("returns FileToolRenderer for file tools", () => {
    expect(getToolRenderer("spike__file_read")).toBe(FileToolRenderer);
    expect(getToolRenderer("spike__file_write")).toBe(FileToolRenderer);
    expect(getToolRenderer("fs_read")).toBe(FileToolRenderer);
    expect(getToolRenderer("read_file")).toBe(FileToolRenderer);
  });

  it("returns SearchToolRenderer for search tools", () => {
    expect(getToolRenderer("github__issue_search")).toBe(SearchToolRenderer);
    expect(getToolRenderer("spike__query_data")).toBe(SearchToolRenderer);
    expect(getToolRenderer("list_items")).toBe(SearchToolRenderer);
  });

  it("returns CodeToolRenderer for code tools", () => {
    expect(getToolRenderer("spike__run_code")).toBe(CodeToolRenderer);
    expect(getToolRenderer("execute_script")).toBe(CodeToolRenderer);
    expect(getToolRenderer("eval_expression")).toBe(CodeToolRenderer);
  });

  it("returns DefaultToolRenderer for unknown tools", () => {
    expect(getToolRenderer("spike__dm_send")).toBe(DefaultToolRenderer);
    expect(getToolRenderer("unknown_tool")).toBe(DefaultToolRenderer);
    expect(getToolRenderer("random")).toBe(DefaultToolRenderer);
  });

  it("strips namespace prefix before matching", () => {
    // "server__file_read" should match file pattern after stripping "server__"
    expect(getToolRenderer("my_server__file_read")).toBe(FileToolRenderer);
  });
});
