import { describe, expect, it } from "vitest";
import {
  buildVerificationPrompt,
  COMPARISON_PROMPT,
  ROOM_ANALYSIS_PROMPT,
  VERIFICATION_PROMPT_TEMPLATE,
} from "./vision-prompts";

describe("vision-prompts", () => {
  it("should export ROOM_ANALYSIS_PROMPT", () => {
    expect(ROOM_ANALYSIS_PROMPT).toBeDefined();
    expect(typeof ROOM_ANALYSIS_PROMPT).toBe("string");
    expect(ROOM_ANALYSIS_PROMPT).toContain("cleaning assessment robot");
  });

  it("should export VERIFICATION_PROMPT_TEMPLATE", () => {
    expect(VERIFICATION_PROMPT_TEMPLATE).toBeDefined();
    expect(typeof VERIFICATION_PROMPT_TEMPLATE).toBe("string");
    expect(VERIFICATION_PROMPT_TEMPLATE).toContain("{description}");
  });

  it("should export COMPARISON_PROMPT", () => {
    expect(COMPARISON_PROMPT).toBeDefined();
    expect(typeof COMPARISON_PROMPT).toBe("string");
    expect(COMPARISON_PROMPT).toContain(
      "Compare these BEFORE and AFTER photos",
    );
  });

  it("should build a verification prompt", () => {
    const task = "Pick up the red shirt from the floor";
    const prompt = buildVerificationPrompt(task);
    expect(prompt).toContain(task);
    expect(prompt).not.toContain("{description}");
  });
});
