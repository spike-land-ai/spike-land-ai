import { describe, expect, it } from "vitest";
import {
  parseExecutableMdxCommand,
  parseExecutableMdxCommands,
} from "@/ui/components/mcp-command-line";

describe("mcp-command-line", () => {
  it("maps shell aliases to qa-studio tools", () => {
    expect(parseExecutableMdxCommand("open https://spike.land")).toEqual({
      command: "open https://spike.land",
      toolName: "web_navigate",
      args: { url: "https://spike.land" },
    });

    expect(parseExecutableMdxCommand('type 4 "hello world"')).toEqual({
      command: 'type 4 "hello world"',
      toolName: "web_type",
      args: { ref: 4, text: "hello world" },
    });
  });

  it("parses direct tool invocations with flags", () => {
    expect(parseExecutableMdxCommand("web_click --ref 12")).toEqual({
      command: "web_click --ref 12",
      toolName: "web_click",
      args: { ref: 12 },
    });

    expect(parseExecutableMdxCommand("web_screenshot --full_page true")).toEqual({
      command: "web_screenshot --full_page true",
      toolName: "web_screenshot",
      args: { full_page: true },
    });
  });

  it("parses multi-line executable blocks and skips comments", () => {
    expect(
      parseExecutableMdxCommands(`
# open the page
open https://spike.land
read main
      `),
    ).toEqual([
      {
        command: "open https://spike.land",
        toolName: "web_navigate",
        args: { url: "https://spike.land" },
      },
      {
        command: "read main",
        toolName: "web_read",
        args: { landmark: "main" },
      },
    ]);
  });

  it("rejects unsupported or mixed shell blocks", () => {
    expect(parseExecutableMdxCommand("npm install react")).toBeNull();

    expect(
      parseExecutableMdxCommands(`
open https://spike.land
npm install react
      `),
    ).toBeNull();
  });
});
