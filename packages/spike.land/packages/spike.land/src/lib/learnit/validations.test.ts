import { describe, expect, it } from "vitest";

import {
  generateTopicSchema,
  learnItPathSchema,
  pathSegmentSchema,
} from "./validations";

describe("pathSegmentSchema", () => {
  it("accepts lowercase alphanumeric with hyphens", () => {
    expect(pathSegmentSchema.parse("my-topic")).toBe("my-topic");
    expect(pathSegmentSchema.parse("react")).toBe("react");
    expect(pathSegmentSchema.parse("es2024")).toBe("es2024");
  });

  it("rejects uppercase characters", () => {
    expect(() => pathSegmentSchema.parse("MyTopic")).toThrow();
  });

  it("rejects spaces", () => {
    expect(() => pathSegmentSchema.parse("my topic")).toThrow();
  });

  it("rejects underscores", () => {
    expect(() => pathSegmentSchema.parse("my_topic")).toThrow();
  });

  it("rejects segment shorter than 2 chars", () => {
    expect(() => pathSegmentSchema.parse("a")).toThrow();
  });

  it("accepts exactly 2 chars", () => {
    expect(pathSegmentSchema.parse("ab")).toBe("ab");
  });

  it("rejects segment longer than 50 chars", () => {
    expect(() => pathSegmentSchema.parse("a".repeat(51))).toThrow();
  });

  it("accepts exactly 50 chars", () => {
    expect(pathSegmentSchema.parse("a".repeat(50))).toBe("a".repeat(50));
  });
});

describe("learnItPathSchema", () => {
  it("accepts array with one segment", () => {
    expect(learnItPathSchema.parse(["react"])).toEqual(["react"]);
  });

  it("accepts array with multiple segments", () => {
    expect(learnItPathSchema.parse(["react", "hooks", "use-effect"])).toEqual([
      "react",
      "hooks",
      "use-effect",
    ]);
  });

  it("rejects empty array", () => {
    expect(() => learnItPathSchema.parse([])).toThrow();
  });

  it("rejects array with > 10 segments", () => {
    const segments = Array(11).fill("ab");
    expect(() => learnItPathSchema.parse(segments)).toThrow();
  });

  it("accepts exactly 10 segments", () => {
    const segments = Array(10).fill("ab");
    expect(learnItPathSchema.parse(segments)).toHaveLength(10);
  });

  it("rejects array with invalid segment", () => {
    expect(() => learnItPathSchema.parse(["valid", "INVALID"])).toThrow();
  });
});

describe("generateTopicSchema", () => {
  it("accepts valid path", () => {
    const result = generateTopicSchema.parse({ path: ["react", "hooks"] });
    expect(result.path).toEqual(["react", "hooks"]);
  });

  it("rejects missing path", () => {
    expect(() => generateTopicSchema.parse({})).toThrow();
  });

  it("rejects invalid path segments", () => {
    expect(() => generateTopicSchema.parse({ path: ["INVALID"] })).toThrow();
  });
});
