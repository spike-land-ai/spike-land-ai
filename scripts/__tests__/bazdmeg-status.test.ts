import { describe, expect, it } from "vitest";
import {
  buildDryRunActions,
  parseBazdmegCliArgs,
  parseGitStatusPorcelain,
  prioritizeSpikeEdgeSuites,
} from "../bazdmeg/status.js";
import type { CheckSuite, Phase3Plan } from "../bazdmeg/types.js";

describe("bazdmeg status helpers", () => {
  it("parses status and dry-run CLI modes", () => {
    expect(parseBazdmegCliArgs([])).toEqual({ mode: "run", verbose: false });
    expect(parseBazdmegCliArgs(["status"])).toEqual({ mode: "status", verbose: false });
    expect(parseBazdmegCliArgs(["dry-run", "--verbose"])).toEqual({
      mode: "dry-run",
      verbose: true,
    });
    expect(parseBazdmegCliArgs(["--status", "-v"])).toEqual({
      mode: "status",
      verbose: true,
    });
  });

  it("parses git porcelain output into staged, modified, and untracked buckets", () => {
    expect(parseGitStatusPorcelain(" M src/a.ts\nM  src/b.ts\n?? src/c.ts\n")).toEqual({
      clean: false,
      modified: ["src/a.ts"],
      staged: ["src/b.ts"],
      untracked: ["src/c.ts"],
      allFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
    });
  });

  it("prioritizes broad spike-edge Worker suites first", () => {
    expect(
      prioritizeSpikeEdgeSuites([
        "proxy.test.ts",
        "coverage-gaps.test.ts",
        "index-full.test.ts",
        "spa.test.ts",
      ]),
    ).toEqual([
      "index-full.test.ts",
      "coverage-gaps.test.ts",
      "spa.test.ts",
      "proxy.test.ts",
    ]);
  });

  it("builds a readable dry-run phase preview", () => {
    const checks: CheckSuite = {
      lint: { name: "lint", passed: true, output: "", durationMs: 10 },
      typecheck: { name: "typecheck", passed: false, output: "TS error", durationMs: 10 },
      test: { name: "test", passed: true, output: "", durationMs: 10 },
      allPassed: false,
      errorCount: 1,
    };
    const phase3Plan: Phase3Plan = {
      currentSha: "abc",
      lastDeployedSha: "def",
      spaDistExists: true,
      spaNeedsDeploy: true,
      workersPending: ["spike-edge", "mcp-auth"],
    };

    expect(
      buildDryRunActions({
        checks,
        git: {
          clean: false,
          modified: ["src/a.ts"],
          staged: [],
          untracked: [],
          allFiles: ["src/a.ts"],
        },
        phase3Plan,
        fixerPromptId: "fixer-v3",
        reviewerPromptId: "reviewer-v3",
        reviewFixerPromptId: "review-fixer-v3",
      }),
    ).toEqual([
      "phase1: would run fixer prompt fixer-v3",
      "phase2: would review 1 changed file(s) with reviewer-v3",
      "phase2: if review rejects files, would use review-fixer-v3",
      "phase3: would deploy spike-app=yes, workers=spike-edge, mcp-auth",
    ]);
  });
});
