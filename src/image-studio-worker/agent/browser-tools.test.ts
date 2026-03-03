import { describe, it, expect } from "vitest";
import { BROWSER_TOOLS, isBrowserTool } from "./browser-tools.ts";

describe("browser-tools", () => {
  it("exports browser tools definitions", () => {
    expect(BROWSER_TOOLS).toBeInstanceOf(Array);
    expect(BROWSER_TOOLS.length).toBeGreaterThan(0);
    expect(BROWSER_TOOLS[0].name).toBe("browser_navigate");
  });

  it("identifies browser tools correctly", () => {
    expect(isBrowserTool("browser_navigate")).toBe(true);
    expect(isBrowserTool("browser_click")).toBe(true);
    expect(isBrowserTool("img_generate")).toBe(false);
    expect(isBrowserTool("something_else")).toBe(false);
  });
});
