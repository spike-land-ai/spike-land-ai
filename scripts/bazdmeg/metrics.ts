import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import type {
  RunRecord,
  RunLog,
  RunLogEvent,
  PromptUsage,
} from "./types.js";

const DATA_DIR = join(process.cwd(), ".bazdmeg");
const METRICS_FILE = join(DATA_DIR, "metrics.json");
const RUNS_DIR = join(DATA_DIR, "runs");

function ensureDirs(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
}

export function generateRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function loadMetrics(): RunRecord[] {
  ensureDirs();
  if (!existsSync(METRICS_FILE)) return [];
  return JSON.parse(readFileSync(METRICS_FILE, "utf-8")) as RunRecord[];
}

export function saveRunRecord(record: RunRecord): void {
  ensureDirs();
  const records = loadMetrics();
  records.push(record);
  // Keep last 50 runs
  const trimmed = records.slice(-50);
  writeFileSync(METRICS_FILE, JSON.stringify(trimmed, null, 2));
}

export function saveRunLog(log: RunLog): void {
  ensureDirs();
  const logPath = join(RUNS_DIR, `${log.runId}.json`);
  writeFileSync(logPath, JSON.stringify(log, null, 2));
}

export function createRunLog(runId: string): RunLog {
  return { runId, events: [] };
}

export function addLogEvent(
  log: RunLog,
  phase: string,
  type: string,
  data: unknown,
): void {
  const event: RunLogEvent = {
    timestamp: new Date().toISOString(),
    phase,
    type,
    data,
  };
  log.events.push(event);
}

export function formatTrend(): string {
  const records = loadMetrics();
  if (records.length === 0) return "No previous runs.";

  const last5 = records.slice(-5);
  const lines: string[] = [`Trend (last ${last5.length} runs):`];

  const p1Rounds = last5.map((r) => String(r.phase1.rounds)).join(" → ");
  const p2Cycles = last5.map((r) => String(r.phase2.cycles)).join(" → ");
  const durations = last5
    .map((r) => `${Math.round(r.totalDurationMs / 60000)}m`)
    .join(" → ");

  lines.push(`  Phase 1 rounds: ${p1Rounds}  ${trendArrow(last5.map((r) => r.phase1.rounds))}`);
  lines.push(`  Phase 2 cycles: ${p2Cycles}  ${trendArrow(last5.map((r) => r.phase2.cycles))}`);
  lines.push(`  Duration:       ${durations}  ${trendArrow(last5.map((r) => r.totalDurationMs))}`);

  // Prompt ELO drift from the last run
  const lastRun = last5[last5.length - 1];
  if (lastRun.promptsUsed.length > 0) {
    lines.push(
      `  Prompts used: ${lastRun.promptsUsed.map((p) => `${p.promptId}(${p.outcome})`).join(", ")}`,
    );
  }

  return lines.join("\n");
}

function trendArrow(values: number[]): string {
  if (values.length < 2) return "";
  const first = values[0];
  const last = values[values.length - 1];
  if (last < first) return "↓ improving";
  if (last > first) return "↑ worsening";
  return "→ stable";
}
