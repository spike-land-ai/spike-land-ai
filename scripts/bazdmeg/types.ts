export type Outcome = "win" | "loss" | "draw";
export type PromptRole = "fixer" | "reviewer" | "review-fixer";
export type RunStatus = "success" | "failed";

export interface EloChange {
  runId: string;
  delta: number;
  outcome: Outcome;
  timestamp: string;
}

export interface PromptRating {
  role: PromptRole;
  elo: number;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  lastUsed: string;
  history: EloChange[];
}

export interface PromptEloFile {
  prompts: Record<string, PromptRating>;
}

export interface PromptVariant {
  id: string;
  role: PromptRole;
  render: (context: PromptContext) => string;
}

export interface PromptContext {
  errors: string;
  files?: string[];
  diffs?: string;
  feedback?: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

export interface CheckSuite {
  lint: CheckResult;
  typecheck: CheckResult;
  test: CheckResult;
  allPassed: boolean;
  errorCount: number;
}

export interface ReviewVerdict {
  file: string;
  verdict: "APPROVE" | "REJECT";
  reason: string;
}

export interface DeployAsset {
  key: string;
  size: number;
  etag: string;
  uploaded: string;
}

export interface VersionInfo {
  sha: string;
  buildTime: string;
  assets: DeployAsset[];
}

export interface DeployState {
  lastSha: string;
  workerHashes: Record<string, string>;
  lastDeployedAt: string;
}

export interface Phase1Result {
  rounds: number;
  durationMs: number;
}

export interface Phase2Result {
  cycles: number;
  filesReviewed: number;
  filesApproved: number;
  durationMs: number;
}

export interface Phase3Result {
  spaUploaded: number;
  spaSkipped: number;
  workersDeployed: string[];
  durationMs: number;
}

export interface PromptUsage {
  promptId: string;
  outcome: Outcome;
}

export interface RunRecord {
  runId: string;
  startedAt: string;
  completedAt: string;
  status: RunStatus;
  gitBranch: string;
  gitSha: string;
  phase1: Phase1Result;
  phase2: Phase2Result;
  phase3: Phase3Result;
  promptsUsed: PromptUsage[];
  totalDurationMs: number;
}

export interface RunLog {
  runId: string;
  events: RunLogEvent[];
}

export interface RunLogEvent {
  timestamp: string;
  phase: string;
  type: string;
  data: unknown;
}
