import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type {
  EloChange,
  Outcome,
  PromptEloFile,
  PromptRating,
  PromptRole,
  PromptVariant,
} from "./types.js";

import fixerV1 from "./prompts/fixer-v1.js";
import fixerV2 from "./prompts/fixer-v2.js";
import reviewerV1 from "./prompts/reviewer-v1.js";
import reviewerV2 from "./prompts/reviewer-v2.js";
import reviewFixerV1 from "./prompts/review-fixer-v1.js";
import reviewFixerV2 from "./prompts/review-fixer-v2.js";

const ALL_PROMPTS: PromptVariant[] = [
  fixerV1,
  fixerV2,
  reviewerV1,
  reviewerV2,
  reviewFixerV1,
  reviewFixerV2,
];

const DATA_DIR = join(process.cwd(), ".bazdmeg");
const ELO_FILE = join(DATA_DIR, "prompt-elo.json");

const DEFAULT_ELO = 1200;
const MAX_HISTORY = 20;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadEloFile(): PromptEloFile {
  ensureDir();
  if (!existsSync(ELO_FILE)) {
    const initial: PromptEloFile = { prompts: {} };
    for (const p of ALL_PROMPTS) {
      initial.prompts[p.id] = {
        role: p.role,
        elo: DEFAULT_ELO,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        lastUsed: "",
        history: [],
      };
    }
    writeFileSync(ELO_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(readFileSync(ELO_FILE, "utf-8")) as PromptEloFile;
}

function saveEloFile(data: PromptEloFile): void {
  ensureDir();
  writeFileSync(ELO_FILE, JSON.stringify(data, null, 2));
}

// Beta distribution sampling via Box-Muller approximation for Thompson sampling
function betaSample(alpha: number, beta: number): number {
  // Use the gamma distribution approach for Beta sampling
  const gammaSample = (shape: number): number => {
    if (shape < 1) {
      return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x: number;
      let v: number;
      do {
        x = normalSample();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };

  const normalSample = (): number => {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };

  const x = gammaSample(alpha);
  const y = gammaSample(beta);
  return x / (x + y);
}

// ELO math — adapted from src/chess-engine/elo.ts
function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

function getKFactor(elo: number, gamesPlayed: number): number {
  if (elo > 2400) return 16;
  if (gamesPlayed < 30) return 40;
  return 32;
}

export function selectPrompt(role: PromptRole): PromptVariant {
  const data = loadEloFile();
  const candidates = ALL_PROMPTS.filter((p) => p.role === role);

  let bestPrompt = candidates[0];
  let bestScore = -1;

  for (const candidate of candidates) {
    const rating = data.prompts[candidate.id];
    const wins = rating ? rating.wins : 0;
    const losses = rating ? rating.losses : 0;
    const sample = betaSample(wins + 1, losses + 1);
    if (sample > bestScore) {
      bestScore = sample;
      bestPrompt = candidate;
    }
  }

  return bestPrompt;
}

export function recordOutcome(
  promptId: string,
  runId: string,
  outcome: Outcome,
): { delta: number; newElo: number } {
  const data = loadEloFile();
  const rating = data.prompts[promptId];
  if (!rating) {
    throw new Error(`Unknown prompt: ${promptId}`);
  }

  // Play against a "baseline" at DEFAULT_ELO
  const baselineElo = DEFAULT_ELO;
  const actualScore = outcome === "win" ? 1.0 : outcome === "draw" ? 0.5 : 0.0;
  const expected = expectedScore(rating.elo, baselineElo);
  const K = getKFactor(rating.elo, rating.matches);
  const delta = Math.round(K * (actualScore - expected));

  rating.elo += delta;
  rating.matches += 1;
  if (outcome === "win") rating.wins += 1;
  else if (outcome === "loss") rating.losses += 1;
  else rating.draws += 1;
  rating.lastUsed = new Date().toISOString();

  const change: EloChange = {
    runId,
    delta,
    outcome,
    timestamp: rating.lastUsed,
  };
  rating.history.push(change);
  if (rating.history.length > MAX_HISTORY) {
    rating.history = rating.history.slice(-MAX_HISTORY);
  }

  saveEloFile(data);
  return { delta, newElo: rating.elo };
}

export function getRatings(): PromptEloFile {
  return loadEloFile();
}

export function formatRankings(): string {
  const data = loadEloFile();
  const roles: PromptRole[] = ["fixer", "reviewer", "review-fixer"];
  const lines: string[] = ["Prompt Arena Rankings:"];

  for (const role of roles) {
    const entries = Object.entries(data.prompts)
      .filter(([, r]) => r.role === role)
      .sort(([, a], [, b]) => b.elo - a.elo);

    if (entries.length === 0) continue;

    lines.push(`  ${role}:`);
    const totalMatches = entries.reduce(
      (sum, [, r]) => sum + r.wins + r.losses + r.draws,
      0,
    );

    for (const [id, r] of entries) {
      const selPct =
        totalMatches > 0
          ? Math.round(((r.wins + r.losses + r.draws) / totalMatches) * 100)
          : 0;
      const spark = r.history
        .slice(-8)
        .map((h) => sparkChar(h.delta))
        .join("");
      lines.push(
        `    ${id}  ELO ${r.elo} (W:${r.wins} L:${r.losses} D:${r.draws})  ${spark}  ← selected ${selPct}%`,
      );
    }
  }

  return lines.join("\n");
}

function sparkChar(delta: number): string {
  if (delta >= 15) return "█";
  if (delta >= 10) return "▇";
  if (delta >= 5) return "▅";
  if (delta >= 0) return "▃";
  return "▁";
}
