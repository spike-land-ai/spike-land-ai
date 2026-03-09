import { execSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CheckSuite, Phase3Plan } from "./types.js";

export type BazdmegMode = "run" | "status" | "dry-run";

export interface BazdmegCliArgs {
  mode: BazdmegMode;
  verbose: boolean;
}

export interface GitStatusSummary {
  clean: boolean;
  modified: string[];
  staged: string[];
  untracked: string[];
  allFiles: string[];
}

export interface SpikeEdgeSuiteSummary {
  totalSuites: number;
  remainingSuites: string[];
  priorityCandidates: string[];
}

const SPIKE_EDGE_TEST_DIR = join(process.cwd(), ".tests/spike-edge/__tests__");
const PRIORITY_WORKER_SUITES = [
  "index-full.test.ts",
  "index-app.test.ts",
  "coverage-gaps.test.ts",
  "spa.test.ts",
  "routes.test.ts",
  "routes-additional.test.ts",
];

export function parseBazdmegCliArgs(args: string[]): BazdmegCliArgs {
  const verbose = args.includes("--verbose") || args.includes("-v");
  const cleaned = args.filter((arg) => arg !== "--verbose" && arg !== "-v");
  const hasStatusFlag = cleaned.includes("--status");
  const hasDryRunFlag = cleaned.includes("--dry-run");
  const positional = cleaned.filter((arg) => !arg.startsWith("--"));
  const primary = positional[0];

  if (primary === "status" || hasStatusFlag) {
    return { mode: "status", verbose };
  }

  if (primary === "dry-run" || hasDryRunFlag) {
    return { mode: "dry-run", verbose };
  }

  return { mode: "run", verbose };
}

export function parseGitStatusPorcelain(output: string): GitStatusSummary {
  const modified: string[] = [];
  const staged: string[] = [];
  const untracked: string[] = [];

  for (const line of output.split("\n")) {
    if (!line.trim()) continue;

    if (line.startsWith("?? ")) {
      untracked.push(line.slice(3).trim());
      continue;
    }

    const indexStatus = line[0] ?? " ";
    const worktreeStatus = line[1] ?? " ";
    const file = line.slice(3).trim();
    if (!file) continue;

    if (indexStatus !== " ") {
      staged.push(file);
    }
    if (worktreeStatus !== " ") {
      modified.push(file);
    }
  }

  const allFiles = Array.from(new Set([...staged, ...modified, ...untracked])).sort();

  return {
    clean: allFiles.length === 0,
    modified: modified.sort(),
    staged: staged.sort(),
    untracked: untracked.sort(),
    allFiles,
  };
}

export function getGitStatusSummary(): GitStatusSummary {
  try {
    const output = execSync("git status --porcelain", {
      encoding: "utf-8",
      cwd: process.cwd(),
    });
    return parseGitStatusPorcelain(output);
  } catch {
    return {
      clean: true,
      modified: [],
      staged: [],
      untracked: [],
      allFiles: [],
    };
  }
}

export function prioritizeSpikeEdgeSuites(suites: string[]): string[] {
  const order = new Map(PRIORITY_WORKER_SUITES.map((file, index) => [file, index]));

  return [...suites].sort((left, right) => {
    const leftRank = order.get(left);
    const rightRank = order.get(right);

    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    return left.localeCompare(right);
  });
}

export function getSpikeEdgeSuiteSummary(): SpikeEdgeSuiteSummary {
  if (!existsSync(SPIKE_EDGE_TEST_DIR)) {
    return {
      totalSuites: 0,
      remainingSuites: [],
      priorityCandidates: [],
    };
  }

  const remainingSuites = readdirSync(SPIKE_EDGE_TEST_DIR)
    .filter((file) => file.endsWith(".test.ts"))
    .sort();

  return {
    totalSuites: remainingSuites.length,
    remainingSuites,
    priorityCandidates: prioritizeSpikeEdgeSuites(remainingSuites).slice(0, 6),
  };
}

export function buildDryRunActions(input: {
  checks: CheckSuite;
  git: GitStatusSummary;
  phase3Plan: Phase3Plan;
  fixerPromptId?: string;
  reviewerPromptId?: string;
  reviewFixerPromptId?: string;
}): string[] {
  const actions: string[] = [];

  if (!input.checks.allPassed) {
    actions.push(`phase1: would run fixer prompt ${input.fixerPromptId ?? "<unknown>"}`);
  } else {
    actions.push("phase1: checks already green, no fixer run");
  }

  if (!input.git.clean) {
    actions.push(
      `phase2: would review ${input.git.allFiles.length} changed file(s) with ${input.reviewerPromptId ?? "<unknown>"}`,
    );
    actions.push(
      `phase2: if review rejects files, would use ${input.reviewFixerPromptId ?? "<unknown>"}`,
    );
  } else {
    actions.push("phase2: working tree clean, no review cycle");
  }

  const deploySummary = input.phase3Plan.workersPending.length
    ? input.phase3Plan.workersPending.join(", ")
    : "none";
  actions.push(
    `phase3: would deploy spike-app=${input.phase3Plan.spaNeedsDeploy ? "yes" : "no"}, workers=${deploySummary}`,
  );

  return actions;
}
