import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "./system-prompt.ts";

describe("system-prompt", () => {
  it("exports the prompt string", () => {
    expect(typeof SYSTEM_PROMPT).toBe("string");
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
    expect(SYSTEM_PROMPT).toContain("You are a creative AI assistant");
  });
});
