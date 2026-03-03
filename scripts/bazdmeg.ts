#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import {
  selectPrompt,
  recordOutcome,
  formatRankings,
  getRatings,
} from "./bazdmeg/prompt-arena.js";
import {
  runAllChecks,
  getFailureOutput,
  formatCheckLine,
} from "./bazdmeg/runner.js";
import { spawnClaude } from "./bazdmeg/agent.js";
import {
  getChangedFiles,
  getPerFileDiffs,
  parseVerdicts,
  commitFiles,
  formatRejectionFeedback,
  isWorkingTreeClean,
} from "./bazdmeg/review.js";
import { runPhase3 } from "./bazdmeg/deploy.js";
import {
  generateRunId,
  saveRunRecord,
  saveRunLog,
  createRunLog,
  addLogEvent,
  formatTrend,
} from "./bazdmeg/metrics.js";
import type {
  Outcome,
  Phase1Result,
  Phase2Result,
  Phase3Result,
  PromptUsage,
  RunRecord,
} from "./bazdmeg/types.js";

function getBranch(): string {
  return execSync("git branch --show-current", {
    encoding: "utf-8",
  }).trim();
}

function getSha(): string {
  return execSync("git rev-parse --short HEAD", {
    encoding: "utf-8",
  }).trim();
}

function header(): void {
  const branch = getBranch();
  const sha = getSha();
  const inner = `  BAZDMEG Pipeline  |  ${branch} @ ${sha}  `;
  const bar = "═".repeat(inner.length);
  console.log(`
╔${bar}╗
║${inner}║
╚${bar}╝
`);
}

// ── Phase 1: Auto-Fix Loop ──────────────────────────────────────────

function phase1(
  runId: string,
  log: ReturnType<typeof createRunLog>,
  promptsUsed: PromptUsage[],
): Phase1Result {
  console.log("── Phase 1: Auto-Fix Loop ─────────────");
  const start = Date.now();
  let round = 0;

  while (true) {
    round++;

    const suite = runAllChecks();
    addLogEvent(log, "phase1", "checks", {
      round,
      lint: suite.lint.passed,
      typecheck: suite.typecheck.passed,
      test: suite.test.passed,
    });

    console.log(`  [Round ${round}]`);
    console.log(formatCheckLine(suite.lint));
    console.log(formatCheckLine(suite.typecheck));
    console.log(formatCheckLine(suite.test));

    if (suite.allPassed) {
      console.log("    ✓ All green.\n");
      break;
    }

    const prompt = selectPrompt("fixer");
    const errorsBefore = suite.errorCount;
    console.log(`    → Agent fixing errors (${prompt.id}, ELO ${getRatings().prompts[prompt.id]?.elo ?? "?"})...`);

    const errors = getFailureOutput(suite);
    addLogEvent(log, "phase1", "agent_spawn", {
      round,
      promptId: prompt.id,
      errors,
    });

    spawnClaude(prompt, { errors });

    // Re-check to score the prompt
    const recheck = runAllChecks();
    const errorsAfter = recheck.errorCount;

    let outcome: Outcome;
    if (recheck.allPassed) {
      outcome = "win";
    } else if (errorsAfter < errorsBefore) {
      outcome = "draw";
    } else {
      outcome = "loss";
    }

    const { delta, newElo } = recordOutcome(prompt.id, runId, outcome);
    promptsUsed.push({ promptId: prompt.id, outcome });
    console.log(
      `    → ${prompt.id}: ${outcome.toUpperCase()} (${delta >= 0 ? "+" : ""}${delta} ELO → ${newElo})`,
    );

    addLogEvent(log, "phase1", "outcome", {
      round,
      promptId: prompt.id,
      outcome,
      delta,
      newElo,
    });
  }

  return { rounds: round, durationMs: Date.now() - start };
}

// ── Phase 2: Review Loop ────────────────────────────────────────────

function phase2(
  runId: string,
  log: ReturnType<typeof createRunLog>,
  promptsUsed: PromptUsage[],
): Phase2Result {
  console.log("── Phase 2: Review Loop ───────────────");
  const start = Date.now();
  let cycle = 0;
  let totalReviewed = 0;
  let totalApproved = 0;

  while (!isWorkingTreeClean()) {
    cycle++;
    const files = getChangedFiles();
    if (files.length === 0) break;

    const diffs = getPerFileDiffs(files);
    const reviewPrompt = selectPrompt("reviewer");
    const reviewElo = getRatings().prompts[reviewPrompt.id]?.elo ?? "?";
    console.log(
      `  [Cycle ${cycle}] prompt: ${reviewPrompt.id} (ELO ${reviewElo})`,
    );

    addLogEvent(log, "phase2", "review_start", {
      cycle,
      files,
      promptId: reviewPrompt.id,
    });

    const agentOutput = spawnClaude(reviewPrompt, { errors: "", diffs });
    const verdicts = parseVerdicts(agentOutput);

    addLogEvent(log, "phase2", "verdicts", { cycle, verdicts });

    const approved = verdicts.filter((v) => v.verdict === "APPROVE");
    const rejected = verdicts.filter((v) => v.verdict === "REJECT");

    totalReviewed += verdicts.length;
    totalApproved += approved.length;

    for (const v of verdicts) {
      const icon = v.verdict === "APPROVE" ? "APPROVE" : "REJECT";
      console.log(`    ${v.file} .... ${icon}`);
      if (v.verdict === "REJECT") {
        console.log(`      (${v.reason})`);
      }
    }

    // Commit approved files
    if (approved.length > 0) {
      const approvedFiles = approved.map((v) => v.file);
      commitFiles(approvedFiles, `chore: auto-reviewed (cycle ${cycle})`);
      console.log(
        `    → Committed ${approved.length} file${approved.length > 1 ? "s" : ""}.`,
      );
    }

    // Score reviewer
    const reviewOutcome: Outcome =
      rejected.length === 0 ? "win" : approved.length > 0 ? "draw" : "loss";
    const { delta: revDelta } = recordOutcome(
      reviewPrompt.id,
      runId,
      reviewOutcome,
    );
    promptsUsed.push({ promptId: reviewPrompt.id, outcome: reviewOutcome });

    // Fix rejected files
    if (rejected.length > 0) {
      const feedback = formatRejectionFeedback(verdicts);
      const fixerPrompt = selectPrompt("review-fixer");
      console.log(`    → Fixing ${rejected.length} rejected file(s) (${fixerPrompt.id})...`);

      addLogEvent(log, "phase2", "fix_start", {
        cycle,
        promptId: fixerPrompt.id,
        rejected: rejected.map((v) => v.file),
      });

      spawnClaude(fixerPrompt, { errors: "", feedback });

      // Re-run checks after fixer
      const recheck = runAllChecks();
      const fixOutcome: Outcome = recheck.allPassed ? "win" : "draw";
      const { delta: fixDelta } = recordOutcome(
        fixerPrompt.id,
        runId,
        fixOutcome,
      );
      promptsUsed.push({ promptId: fixerPrompt.id, outcome: fixOutcome });

      addLogEvent(log, "phase2", "fix_outcome", {
        cycle,
        promptId: fixerPrompt.id,
        outcome: fixOutcome,
        delta: fixDelta,
      });
    }
  }

  if (cycle === 0) {
    console.log("    ✓ Working tree clean — nothing to review.\n");
  } else {
    console.log("    ✓ Working tree clean.\n");
  }

  return {
    cycles: cycle,
    filesReviewed: totalReviewed,
    filesApproved: totalApproved,
    durationMs: Date.now() - start,
  };
}

// ── Phase 3: Smart Deploy ───────────────────────────────────────────

function phase3(log: ReturnType<typeof createRunLog>): Phase3Result {
  console.log("── Phase 3: Smart Deploy ──────────────");

  addLogEvent(log, "phase3", "start", {});
  const result = runPhase3();

  const workers =
    result.workersDeployed.length > 0
      ? result.workersDeployed.join(", ")
      : "none";
  console.log(
    `  SPA: ${result.spaUploaded} upload, ${result.spaSkipped} skip (hash match)`,
  );
  console.log(`  Workers: ${workers}`);
  console.log("  ✓ Deployed.\n");

  addLogEvent(log, "phase3", "complete", result);
  return result;
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  header();

  const runId = generateRunId();
  const log = createRunLog(runId);
  const promptsUsed: PromptUsage[] = [];
  const startedAt = new Date().toISOString();
  const totalStart = Date.now();

  try {
    const p1 = phase1(runId, log, promptsUsed);
    const p2 = phase2(runId, log, promptsUsed);
    const p3 = phase3(log);

    const totalDurationMs = Date.now() - totalStart;
    const record: RunRecord = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "success",
      gitBranch: getBranch(),
      gitSha: getSha(),
      phase1: p1,
      phase2: p2,
      phase3: p3,
      promptsUsed,
      totalDurationMs,
    };

    saveRunRecord(record);
    saveRunLog(log);

    // Summary
    const durMin = Math.floor(totalDurationMs / 60000);
    const durSec = Math.round((totalDurationMs % 60000) / 1000);
    console.log("══════════════════════════════════════");
    console.log(
      `  ${p1.rounds} fix round${p1.rounds !== 1 ? "s" : ""}, ${p2.cycles} review cycle${p2.cycles !== 1 ? "s" : ""}, ${durMin}m ${durSec}s`,
    );
    console.log(`  ${formatRankings()}`);
    console.log("");
    console.log(formatTrend());
    console.log("══════════════════════════════════════");
  } catch (err) {
    const totalDurationMs = Date.now() - totalStart;
    const record: RunRecord = {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "failed",
      gitBranch: getBranch(),
      gitSha: getSha(),
      phase1: { rounds: 0, durationMs: 0 },
      phase2: { cycles: 0, filesReviewed: 0, filesApproved: 0, durationMs: 0 },
      phase3: { spaUploaded: 0, spaSkipped: 0, workersDeployed: [], durationMs: 0 },
      promptsUsed,
      totalDurationMs,
    };
    saveRunRecord(record);
    addLogEvent(log, "error", "fatal", { error: String(err) });
    saveRunLog(log);
    console.error("Pipeline failed:", err);
    process.exit(1);
  }
}

main();
