import { describe, expect, it } from "vitest";
import { ADJECTIVES, generateCodespaceId, NOUNS, VERBS } from "./codespace-id";

describe("word lists", () => {
  it("should have 15 adjectives", () => {
    expect(ADJECTIVES).toHaveLength(15);
  });

  it("should have 15 nouns", () => {
    expect(NOUNS).toHaveLength(15);
  });

  it("should have 15 verbs", () => {
    expect(VERBS).toHaveLength(15);
  });
});

describe("generateCodespaceId", () => {
  it("should return a string with 4 dot-separated parts", () => {
    const id = generateCodespaceId();
    const parts = id.split(".");
    expect(parts).toHaveLength(4);
  });

  it("should use an adjective from the word list as first part", () => {
    const id = generateCodespaceId();
    const firstPart = id.split(".")[0]!;
    expect(ADJECTIVES).toContain(firstPart);
  });

  it("should use a noun from the word list as second part", () => {
    const id = generateCodespaceId();
    const secondPart = id.split(".")[1]!;
    expect(NOUNS).toContain(secondPart);
  });

  it("should use a verb from the word list as third part", () => {
    const id = generateCodespaceId();
    const thirdPart = id.split(".")[2]!;
    expect(VERBS).toContain(thirdPart);
  });

  it("should have a 4-character alphanumeric suffix", () => {
    const id = generateCodespaceId();
    const suffix = id.split(".")[3]!;
    expect(suffix).toHaveLength(4);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });

  it("should generate different IDs on successive calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(generateCodespaceId());
    }
    // With randomness, 20 calls should produce at least 2 unique IDs
    expect(ids.size).toBeGreaterThan(1);
  });
});
