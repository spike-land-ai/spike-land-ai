import { describe, expect, it } from "vitest";
import { applyPatch, parseUnifiedDiff, threeWayMerge } from "./engine";

describe("diff engine", () => {
  it("should parse a unified diff", () => {
    const diff = `+++ file.ts\n@@ -1,1 +1,1 @@\n-old\n+new`;
    const parsed = parseUnifiedDiff(diff);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.path).toBe("file.ts");
    expect(parsed[0]!.hunks[0]!.lines).toContain("-old");
    expect(parsed[0]!.hunks[0]!.lines).toContain("+new");
  });

  it("should apply a patch", () => {
    const base = "line 1\nline 2\nline 3";
    const hunks = [
      {
        oldStart: 2,
        oldLines: 1,
        newStart: 2,
        newLines: 1,
        lines: ["-line 2", "+modified line 2"],
      },
    ];
    const result = applyPatch(base, hunks);
    expect(result).toBe("line 1\nmodified line 2\nline 3");
  });

  it("should perform a three-way merge", () => {
    const base = "base";
    const ours = "ours";
    const theirs = "theirs";
    const result = threeWayMerge(base, ours, theirs);
    expect(result.conflicts).toBe(true);
    expect(result.content).toContain("<<<<<<< OURS");
  });
});
