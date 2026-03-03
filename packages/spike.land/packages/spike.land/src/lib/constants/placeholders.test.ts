import { describe, expect, it, vi } from "vitest";

import {
  BAZDMEG_PLACEHOLDERS,
  CHAT_PLACEHOLDERS,
  getRandomBazdmegPlaceholder,
  getRandomPlaceholder,
} from "./placeholders";

describe("CHAT_PLACEHOLDERS", () => {
  it("is a non-empty array of strings", () => {
    expect(CHAT_PLACEHOLDERS.length).toBeGreaterThan(0);
    for (const p of CHAT_PLACEHOLDERS) {
      expect(typeof p).toBe("string");
    }
  });
});

describe("BAZDMEG_PLACEHOLDERS", () => {
  it("is a non-empty array of strings", () => {
    expect(BAZDMEG_PLACEHOLDERS.length).toBeGreaterThan(0);
    for (const p of BAZDMEG_PLACEHOLDERS) {
      expect(typeof p).toBe("string");
    }
  });
});

describe("getRandomPlaceholder", () => {
  it("returns a string from CHAT_PLACEHOLDERS", () => {
    const result = getRandomPlaceholder();
    expect(CHAT_PLACEHOLDERS).toContain(result);
  });

  it("uses deterministic index when Math.random is mocked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomPlaceholder()).toBe(CHAT_PLACEHOLDERS[0]);
    vi.restoreAllMocks();
  });

  it("uses default placeholder as fallback param", () => {
    const result = getRandomPlaceholder("Custom default");
    expect(typeof result).toBe("string");
  });
});

describe("getRandomBazdmegPlaceholder", () => {
  it("returns a string from BAZDMEG_PLACEHOLDERS", () => {
    const result = getRandomBazdmegPlaceholder();
    expect(BAZDMEG_PLACEHOLDERS).toContain(result);
  });

  it("uses deterministic index when Math.random is mocked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(getRandomBazdmegPlaceholder()).toBe(BAZDMEG_PLACEHOLDERS[0]);
    vi.restoreAllMocks();
  });
});
