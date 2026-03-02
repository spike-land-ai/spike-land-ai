/**
 * Spike Review — Types and Schemas
 *
 * Core type definitions for the code review MCP server.
 * Adapted from jamesjfoong/github-pr-review-mcp (MIT).
 */

import { z } from "zod";

// ── Enums ────────────────────────────────────────────────────────────────────

export enum DiffSide {
  LEFT = "LEFT",
  RIGHT = "RIGHT",
}

export enum ReviewEvent {
  APPROVE = "APPROVE",
  REQUEST_CHANGES = "REQUEST_CHANGES",
  COMMENT = "COMMENT",
}

export enum FileStatus {
  ADDED = "added",
  MODIFIED = "modified",
  DELETED = "deleted",
  RENAMED = "renamed",
}

export type GateStatus = "GREEN" | "YELLOW" | "RED";

export type ConfidenceLevel = "critical" | "high" | "medium" | "low";

// ── Zod Schemas ──────────────────────────────────────────────────────────────

export const PRParamsSchema = z.object({
  owner: z.string().describe("Repository owner/organization"),
  repo: z.string().describe("Repository name"),
  prNumber: z.number().int().positive().describe("Pull request number"),
});

export const SubmitReviewSchema = PRParamsSchema.extend({
  body: z.string().describe("Review comment body"),
  event: z.enum(["APPROVE", "REQUEST_CHANGES", "COMMENT"]).describe("Review action"),
  comments: z
    .array(
      z.object({
        path: z.string(),
        line: z.number().int().positive(),
        body: z.string(),
      }),
    )
    .optional()
    .describe("Inline review comments"),
});

export const ReviewDiffSchema = z.object({
  diff: z.string().describe("Git diff content to review"),
  context: z.string().optional().describe("Additional context (e.g. PR description)"),
  rules: z.array(z.string()).optional().describe("Additional review rules to apply"),
});

export const ReviewPRSchema = PRParamsSchema.extend({
  customPrompt: z.string().optional().describe("Custom review prompt to use instead of defaults"),
  rulesPath: z.string().optional().describe("Path to CLAUDE.md or .spike-review.yaml for rules"),
});

export const CheckGatesSchema = z.object({
  diff: z.string().describe("Git diff to check against BAZDMEG gates"),
  claudeMdContent: z.string().optional().describe("CLAUDE.md content for project-specific rules"),
});

export const ValidateCommentTargetSchema = PRParamsSchema.extend({
  path: z.string().describe("File path in the diff"),
  line: z.number().int().positive().describe("Line number to comment on"),
  side: z.nativeEnum(DiffSide).optional().describe("Side of the diff"),
});

export const PostCheckRunSchema = PRParamsSchema.extend({
  headSha: z.string().describe("Commit SHA to attach the check to"),
  status: z.enum(["queued", "in_progress", "completed"]).describe("Check run status"),
  conclusion: z
    .enum(["success", "failure", "neutral", "action_required"])
    .optional()
    .describe("Check conclusion (required when status is completed)"),
  summary: z.string().describe("Summary of the review"),
  details: z.string().optional().describe("Detailed markdown output"),
});

// ── TypeScript Interfaces ────────────────────────────────────────────────────

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface FileDiffInfo {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch?: string;
  hunks: DiffHunk[];
}

export interface PRDetails {
  title: string;
  body: string | null;
  state: string;
  author: string | undefined;
  createdAt: string;
  updatedAt: string;
  mergeable: boolean | null;
  merged: boolean;
  additions: number;
  deletions: number;
  changedFiles: number;
  headSha: string;
  baseSha: string;
  baseRef: string;
  headRef: string;
}

export interface ReviewFinding {
  path: string;
  line: number;
  side: DiffSide;
  body: string;
  confidence: number;
  level: ConfidenceLevel;
  category: string;
}

export interface ReviewResult {
  summary: string;
  decision: ReviewEvent;
  findings: ReviewFinding[];
  gateResults: GateResult[];
}

export interface GateResult {
  name: string;
  status: GateStatus;
  detail: string;
}

export interface CommentTargetValidation {
  valid: boolean;
  reason?: string;
  nearestValidLine?: { line: number; side: DiffSide };
}

export interface SpikeReviewConfig {
  confidenceThreshold: number;
  rules: string[];
  ignorePaths: string[];
  autoMerge: boolean;
  autoMergeMinApprovals: number;
}

export const DEFAULT_CONFIG: SpikeReviewConfig = {
  confidenceThreshold: 80,
  rules: [],
  ignorePaths: ["*.lock", "*.lockb", "*.snap", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
  autoMerge: false,
  autoMergeMinApprovals: 1,
};
