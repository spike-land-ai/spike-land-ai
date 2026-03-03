import { describe, expect, it } from "vitest";
import { PLATFORM_HELPER_SYSTEM_PROMPT } from "./platform-helper-prompt";

describe("PLATFORM_HELPER_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).toBeTruthy();
    expect(typeof PLATFORM_HELPER_SYSTEM_PROMPT).toBe("string");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("mentions spike.land", () => {
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).toContain("spike.land");
  });

  it("describes platform features", () => {
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).toContain("Code Editor");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).toContain("Image Enhancement");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).toContain("LearnIt");
  });

  it("does not contain sensitive patterns", () => {
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).not.toContain("API_KEY");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).not.toContain("secret");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).not.toContain("password");
    expect(PLATFORM_HELPER_SYSTEM_PROMPT).not.toContain("token");
  });
});
