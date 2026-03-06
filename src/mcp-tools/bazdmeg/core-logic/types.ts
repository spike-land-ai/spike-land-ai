/**
 * BAZDMEG MCP — Types and Schemas
 *
 * All Zod schemas and TypeScript interfaces for the BAZDMEG MCP server.
 */

import { z } from "zod";

// ── Gate Types ──────────────────────────────────────────────────────────────

export type GateStatus = "GREEN" | "YELLOW" | "RED";

export interface GateResult {
  name: string;
  status: GateStatus;
  detail: string;
}

export interface ReviewRule {
  name: string;
  description: string;
  category: string;
  check: (context: RuleContext) => GateResult;
}

export interface RuleContext {
  diff: string;
  files: string[];
  additions: number;
  deletions: number;
  prTitle: string;
  prBody: string | null;
  claudeMdRules: string[];
  allowedPaths?: string[] | undefined;
}

// ── Workspace Types ─────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  packageName: string;
  packagePath: string;
  allowedPaths: string[];
  dependencies: string[];
  enteredAt: string;
}

export interface WorkspaceConfigFile {
  packageName: string;
  allowedPaths: string[];
  enteredAt: string;
}

export interface ResolvedDependencies {
  direct: string[];
  paths: string[];
}

// ── Context Bundle Types ────────────────────────────────────────────────────

export interface ContextBundle {
  packageName: string;
  claudeMd: string | null;
  packageJson: PackageJsonSummary | null;
  exportedTypes: ExportedSymbol[];
  dependencyContexts: DependencyContext[];
}

export interface PackageJsonSummary {
  name: string;
  version: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface ExportedSymbol {
  file: string;
  symbols: string[];
}

export interface DependencyContext {
  packageName: string;
  summary: string;
}

// ── Telemetry Types ─────────────────────────────────────────────────────────

export interface TelemetryEvent {
  eventType: string;
  tool: string;
  workspace: string | null;
  metadata: Record<string, unknown>;
  timestamp: string;
  durationMs?: number | undefined;
}

// ── Stuck Signal Types ──────────────────────────────────────────────────────

export interface StuckSignal {
  packageName: string | null;
  reason: string;
  attemptedAction: string;
  suggestedContext?: string | undefined;
  timestamp: string;
  contextServed: string[];
  allowedPaths: string[];
}

// ── Context Gap Types ───────────────────────────────────────────────────────

export interface ContextGap {
  packageName: string | null;
  missingContext: string;
  whatWasNeeded: string;
  timestamp: string;
}

// ── Session Review Types ────────────────────────────────────────────────────

export interface SessionReview {
  packageName: string | null;
  contextServed: string[];
  contextGaps: ContextGap[];
  suggestions: string[];
  timestamp: string;
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

export const EnterWorkspaceSchema = z.object({
  packageName: z.string().describe("Name of the package to enter (e.g. 'chess-engine')"),
});

export const CheckGateSchema = z.object({
  gateName: z.string().describe("Name of the gate to check"),
  diff: z.string().optional().describe("Git diff to check (uses workspace diff if not provided)"),
});

export const RunGatesSchema = z.object({
  diff: z.string().describe("Git diff to check against all quality gates"),
  prTitle: z.string().optional().describe("PR title for description quality gate"),
  prBody: z.string().optional().describe("PR body for description quality gate"),
});

export const ReportContextGapSchema = z.object({
  missingContext: z.string().describe("Description of what context was missing"),
  whatWasNeeded: z.string().describe("What the agent was trying to accomplish"),
});

export const SignalStuckSchema = z.object({
  reason: z.string().describe("Why the agent is stuck"),
  attemptedAction: z.string().describe("What action was attempted"),
  suggestedContext: z.string().optional().describe("What context might help"),
});

export const SessionBootstrapSchema = z.object({
  packageName: z.string().describe("Package to bootstrap session for"),
  branch: z.string().optional().describe("Expected branch name"),
});

export const PlanningInterviewSchema = z.object({
  taskDescription: z
    .string()
    .optional()
    .describe("What task is being planned (required for first call)"),
  packageName: z
    .string()
    .optional()
    .describe("Target package (uses current workspace if not provided)"),
  sessionId: z
    .string()
    .optional()
    .describe("Session ID for follow-up rounds (omit for first call)"),
  answers: z
    .tuple([
      z.number().int().min(0).max(3),
      z.number().int().min(0).max(3),
      z.number().int().min(0).max(3),
    ])
    .optional()
    .describe("Answers for 3 questions (0-3 index, required for follow-up calls)"),
});

export const PrePRCheckSchema = z.object({
  diff: z.string().describe("Full diff for the PR"),
  prTitle: z.string().describe("PR title"),
  prBody: z.string().describe("PR body/description"),
});

export const AutoShipSchema = z.object({
  commitMessage: z
    .string()
    .optional()
    .describe("Commit message (default: chore(<pkg>): auto-ship changes)"),
  packageName: z.string().optional().describe("Which package to ship (default: active workspace)"),
  push: z.boolean().optional().default(true).describe("Whether to push after commit"),
  dryRun: z.boolean().optional().default(false).describe("Run checks only, skip commit/push"),
});

// ── Build & Typecheck Schemas ───────────────────────────────────────────────

export const BuildSchema = z.object({
  packageName: z.string().describe("Name of the package to build"),
  kind: z
    .enum(["library", "mcp-server", "worker", "cli", "browser"])
    .optional()
    .describe("Build profile override (default: read from packages.yaml)"),
});

export const TypecheckSchema = z.object({
  packageName: z.string().optional().describe("Package to typecheck (optional = all packages)"),
});

// ── Publish Schemas ─────────────────────────────────────────────────────────

export const GeneratePackageJsonSchema = z.object({
  packageName: z.string().describe("Name of the package"),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, only output JSON without writing to disk"),
});

export const PublishNpmSchema = z.object({
  packageName: z.string().describe("Name of the package to publish"),
  registry: z
    .enum(["github", "npm"])
    .optional()
    .default("github")
    .describe("Target registry (default: github)"),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, show what would happen without publishing"),
});

// ── Deploy Schemas ──────────────────────────────────────────────────────────

export const GenerateWranglerTomlSchema = z.object({
  packageName: z.string().describe("Name of the worker package"),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, only output TOML without writing to disk"),
});

export const DeployWorkerSchema = z.object({
  packageName: z.string().describe("Name of the worker package to deploy"),
  env: z.string().optional().describe("Wrangler environment (e.g., staging, production)"),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, show what would happen without deploying"),
});

// ── Mirror Schema ───────────────────────────────────────────────────────────

export const SyncMirrorSchema = z.object({
  packageName: z.string().describe("Name of the package to sync to its mirror repo"),
  dryRun: z
    .boolean()
    .optional()
    .default(true)
    .describe("If true, show what would happen without syncing"),
});

// ── Manifest Schemas ────────────────────────────────────────────────────────

export const ManifestQuerySchema = z.object({
  packageName: z.string().optional().describe("Filter by package name"),
  kind: z
    .string()
    .optional()
    .describe("Filter by package kind (e.g., library, worker, mcp-server)"),
  field: z.string().optional().describe("Return only this field from matching packages"),
});

export const ManifestValidateSchema = z.object({}).strict();

// ── Dep Graph Schema ────────────────────────────────────────────────────────

export const DepGraphSchema = z.object({
  packageName: z.string().optional().describe("Root package (optional = entire graph)"),
  format: z
    .enum(["tree", "list", "mermaid"])
    .optional()
    .default("tree")
    .describe("Output format (default: tree)"),
});
