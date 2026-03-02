import { describe, expect, it } from "vitest";
import { collect, parseInlineServers, parseInlineUrls } from "./common";

describe("common command helpers", () => {
  it("collect appends to array", () => {
    expect(collect("a", [])).toEqual(["a"]);
    expect(collect("b", ["a"])).toEqual(["a", "b"]);
  });

  it("parseInlineServers parses name=command", () => {
    expect(parseInlineServers(["s1=cmd1"])).toEqual([{ name: "s1", command: "cmd1" }]);
  });

  it("parseInlineServers throws on invalid format", () => {
    expect(() => parseInlineServers(["invalid"])).toThrow("Invalid --server format");
    expect(() => parseInlineServers(["=cmd"])).toThrow("Server name must not be empty");
    expect(() => parseInlineServers(["s1="])).toThrow("Server command must not be empty");
  });

  it("parseInlineUrls parses name=url", () => {
    expect(parseInlineUrls(["s1=http://localhost:8080"])).toEqual([{ name: "s1", url: "http://localhost:8080" }]);
  });

  it("parseInlineUrls validates ports", () => {
    expect(() => parseInlineUrls(["s1=http://localhost:99999"])).toThrow("Port must be 1–65535");
  });
});
