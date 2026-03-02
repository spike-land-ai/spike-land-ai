/**
 * GitHub API Client
 *
 * Wraps Octokit for PR reviews, inline comments, and check runs.
 * Supports both PAT and GitHub App JWT authentication.
 */

import { Octokit } from "@octokit/rest";
import { DiffSide } from "../types.js";
import type {
  CommentTargetValidation,
  DiffHunk,
  FileDiffInfo,
  FileStatus,
  PRDetails,
} from "../types.js";

export interface GitHubClientOptions {
  token: string;
}

export class GitHubClient {
  private octokit: Octokit;

  constructor(options: GitHubClientOptions) {
    this.octokit = new Octokit({ auth: options.token });
  }

  async getPRDetails(owner: string, repo: string, prNumber: number): Promise<PRDetails> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      });

      return {
        title: data.title,
        body: data.body,
        state: data.state,
        author: data.user?.login,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        mergeable: data.mergeable,
        merged: data.merged,
        additions: data.additions,
        deletions: data.deletions,
        changedFiles: data.changed_files,
        headSha: data.head.sha,
        baseSha: data.base.sha,
        baseRef: data.base.ref,
        headRef: data.head.ref,
      };
    } catch (err) {
      throw new Error(`Failed to get PR details for ${owner}/${repo}#${prNumber}: ${String(err)}`);
    }
  }

  async getPRDiff(owner: string, repo: string, prNumber: number): Promise<string> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
        mediaType: { format: "diff" },
      });

      if (typeof data !== "string") {
        throw new Error("GitHub API returned non-string data for diff format");
      }

      return data;
    } catch (err) {
      throw new Error(`Failed to get PR diff for ${owner}/${repo}#${prNumber}: ${String(err)}`);
    }
  }

  async getPRFiles(owner: string, repo: string, prNumber: number): Promise<FileDiffInfo[]> {
    try {
      const { data } = await this.octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      });

      return data.map((file) => ({
        filename: file.filename,
        status: file.status as FileStatus,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        hunks: file.patch ? parseDiffHunks(file.patch) : [],
      }));
    } catch (err) {
      throw new Error(`Failed to get PR files for ${owner}/${repo}#${prNumber}: ${String(err)}`);
    }
  }

  async submitReview(
    owner: string,
    repo: string,
    prNumber: number,
    params: {
      body: string;
      event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
      commitId: string;
      comments?: Array<{
        path: string;
        line: number;
        body: string;
        side?: "LEFT" | "RIGHT";
      }>;
    },
  ): Promise<{ id: number }> {
    try {
      const { data } = await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: params.commitId,
        body: params.body,
        event: params.event,
        comments: params.comments?.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
          side: c.side ?? "RIGHT",
        })),
      });

      return { id: data.id };
    } catch (err) {
      throw new Error(`Failed to submit review for ${owner}/${repo}#${prNumber}: ${String(err)}`);
    }
  }

  async createCheckRun(
    owner: string,
    repo: string,
    params: {
      name: string;
      headSha: string;
      status: "queued" | "in_progress" | "completed";
      conclusion?: "success" | "failure" | "neutral" | "action_required";
      summary: string;
      details?: string;
    },
  ): Promise<{ id: number }> {
    try {
      const { data } = await this.octokit.rest.checks.create({
        owner,
        repo,
        name: params.name,
        head_sha: params.headSha,
        status: params.status,
        conclusion: params.conclusion,
        output: {
          title: params.name,
          summary: params.summary,
          text: params.details,
        },
      });

      return { id: data.id };
    } catch (err) {
      throw new Error(`Failed to create check run for ${owner}/${repo}: ${String(err)}`);
    }
  }

  async updateCheckRun(
    owner: string,
    repo: string,
    checkRunId: number,
    params: {
      status: "queued" | "in_progress" | "completed";
      conclusion?: "success" | "failure" | "neutral" | "action_required";
      summary: string;
      details?: string;
    },
  ): Promise<void> {
    try {
      await this.octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: checkRunId,
        status: params.status,
        conclusion: params.conclusion,
        output: {
          title: "Spike Review",
          summary: params.summary,
          text: params.details,
        },
      });
    } catch (err) {
      throw new Error(
        `Failed to update check run ${checkRunId} for ${owner}/${repo}: ${String(err)}`,
      );
    }
  }

  validateCommentTarget(
    hunks: DiffHunk[],
    targetLine: number,
    side: DiffSide = DiffSide.RIGHT,
  ): CommentTargetValidation {
    let nearestLine: number | undefined;
    let nearestDistance = Infinity;

    for (const hunk of hunks) {
      const startLine = side === DiffSide.RIGHT ? hunk.newStart : hunk.oldStart;
      const numLines = side === DiffSide.RIGHT ? hunk.newLines : hunk.oldLines;
      const endLine = startLine + numLines - 1;

      if (targetLine >= startLine && targetLine <= endLine) {
        return { valid: true };
      }

      const distToStart = Math.abs(targetLine - startLine);
      const distToEnd = Math.abs(targetLine - endLine);
      const minDist = Math.min(distToStart, distToEnd);
      if (minDist < nearestDistance) {
        nearestDistance = minDist;
        nearestLine = distToStart < distToEnd ? startLine : endLine;
      }
    }

    return {
      valid: false,
      reason: `Line ${targetLine} is not within any diff hunk`,
      nearestValidLine: nearestLine ? { line: nearestLine, side } : undefined,
    };
  }
}

// ── Diff Parser ──────────────────────────────────────────────────────────────

export function parseDiffHunks(patch: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  const hunkRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;
  const lines = patch.split("\n");

  let currentHunk: DiffHunk | undefined;

  for (const line of lines) {
    const match = hunkRegex.exec(line);
    if (match) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      currentHunk = {
        oldStart: parseInt(match[1] ?? "0", 10),
        oldLines: parseInt(match[2] ?? "1", 10),
        newStart: parseInt(match[3] ?? "0", 10),
        newLines: parseInt(match[4] ?? "1", 10),
        lines: [line],
      };
    } else if (currentHunk) {
      currentHunk.lines.push(line);
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}
