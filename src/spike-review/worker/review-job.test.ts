/**
 * Review Job Tests
 *
 * Tests the orchestration flow with mocked GitHub client and Claude API.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PRContext } from "./webhook-handler.js";
import type { Env } from "./env.js";

// ── Mocks ───────────────────────────────────────────────────────────────────

const {
  mockGetPRDetails,
  mockGetPRDiff,
  mockGetPRFiles,
  mockCreateCheckRun,
  mockUpdateCheckRun,
  mockSubmitReview,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetPRDetails: vi.fn(),
  mockGetPRDiff: vi.fn(),
  mockGetPRFiles: vi.fn(),
  mockCreateCheckRun: vi.fn(),
  mockUpdateCheckRun: vi.fn(),
  mockSubmitReview: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("../github/client.js", () => ({
  GitHubClient: class MockGitHubClient {
    getPRDetails = mockGetPRDetails;
    getPRDiff = mockGetPRDiff;
    getPRFiles = mockGetPRFiles;
    createCheckRun = mockCreateCheckRun;
    updateCheckRun = mockUpdateCheckRun;
    submitReview = mockSubmitReview;
  },
}));

vi.stubGlobal("fetch", mockFetch);

// Import after mocks
const { runReviewJob } = await import("./review-job.js");

// ── Test Data ───────────────────────────────────────────────────────────────

const testCtx: PRContext = {
  owner: "my-org",
  repo: "my-repo",
  prNumber: 42,
  headSha: "abc123",
  action: "opened",
};

const testEnv: Env = {
  GITHUB_TOKEN: "ghp_test",
  GITHUB_WEBHOOK_SECRET: "secret",
  CLAUDE_CODE_OAUTH_TOKEN: "oauth_test_token",
};

const mockPRDetails = {
  title: "Add feature",
  body: "This adds a great feature with detailed explanation.",
  state: "open",
  author: "testuser",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  mergeable: true,
  merged: false,
  additions: 20,
  deletions: 5,
  changedFiles: 2,
  headSha: "abc123",
  baseSha: "def456",
  baseRef: "main",
  headRef: "feature/test",
};

const mockDiff = `--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,5 @@
 import { foo } from "./foo.js";
+import { bar } from "./bar.js";
+
 export function main() {
-  return foo();
+  return bar(foo());
 }`;

const mockFiles = [
  {
    filename: "src/index.ts",
    status: "modified",
    additions: 3,
    deletions: 1,
    patch: mockDiff,
    hunks: [],
  },
  {
    filename: "src/index.test.ts",
    status: "modified",
    additions: 10,
    deletions: 2,
    patch: "",
    hunks: [],
  },
];

// ── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  mockGetPRDetails.mockResolvedValue(mockPRDetails);
  mockGetPRDiff.mockResolvedValue(mockDiff);
  mockGetPRFiles.mockResolvedValue(mockFiles);
  mockCreateCheckRun.mockResolvedValue({ id: 999 });
  mockUpdateCheckRun.mockResolvedValue(undefined);
  mockSubmitReview.mockResolvedValue({ id: 1001 });

  mockFetch.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        content: [
          {
            type: "text",
            text: "Code looks good. Minor suggestion: consider adding error handling.",
          },
        ],
      }),
  });
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe("runReviewJob", () => {
  it("creates a check run in_progress", async () => {
    await runReviewJob(testCtx, testEnv);
    expect(mockCreateCheckRun).toHaveBeenCalledWith("my-org", "my-repo", {
      name: "Spike Review",
      headSha: "abc123",
      status: "in_progress",
      summary: expect.stringContaining("Running"),
    });
  });

  it("fetches PR details, diff, and files", async () => {
    await runReviewJob(testCtx, testEnv);
    expect(mockGetPRDetails).toHaveBeenCalledWith("my-org", "my-repo", 42);
    expect(mockGetPRDiff).toHaveBeenCalledWith("my-org", "my-repo", 42);
    expect(mockGetPRFiles).toHaveBeenCalledWith("my-org", "my-repo", 42);
  });

  it("calls Claude API with OAuth headers", async () => {
    await runReviewJob(testCtx, testEnv);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer oauth_test_token",
          "anthropic-beta": "oauth-2025-04-20",
        }),
      }),
    );
  });

  it("submits review to GitHub", async () => {
    await runReviewJob(testCtx, testEnv);
    expect(mockSubmitReview).toHaveBeenCalledWith(
      "my-org",
      "my-repo",
      42,
      expect.objectContaining({
        commitId: "abc123",
        event: expect.stringMatching(/^(APPROVE|REQUEST_CHANGES|COMMENT)$/),
        body: expect.stringContaining("BAZDMEG"),
      }),
    );
  });

  it("updates check run to completed on success", async () => {
    await runReviewJob(testCtx, testEnv);
    expect(mockUpdateCheckRun).toHaveBeenCalledWith(
      "my-org",
      "my-repo",
      999,
      expect.objectContaining({
        status: "completed",
        conclusion: "success",
      }),
    );
  });

  it("returns success summary", async () => {
    const result = await runReviewJob(testCtx, testEnv);
    expect(result.success).toBe(true);
    expect(result.summary).toMatch(/GREEN|YELLOW/);
  });

  it("marks check as action_required when gates are RED", async () => {
    // Trigger RED gate: no test files + code files changed
    mockGetPRFiles.mockResolvedValue([
      {
        filename: "src/index.ts",
        status: "modified",
        additions: 10,
        deletions: 5,
        patch: "+const x: any = 1;",
        hunks: [],
      },
    ]);
    mockGetPRDiff.mockResolvedValue("+const x: any = 1;");

    await runReviewJob(testCtx, testEnv);
    expect(mockUpdateCheckRun).toHaveBeenCalledWith(
      "my-org",
      "my-repo",
      999,
      expect.objectContaining({
        conclusion: "action_required",
      }),
    );
  });

  it("handles Claude API failure gracefully", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    const result = await runReviewJob(testCtx, testEnv);
    expect(result.success).toBe(false);
    expect(result.summary).toContain("500");
    expect(mockUpdateCheckRun).toHaveBeenCalledWith(
      "my-org",
      "my-repo",
      999,
      expect.objectContaining({
        status: "completed",
        conclusion: "failure",
      }),
    );
  });

  it("handles GitHub client failure gracefully", async () => {
    mockGetPRDetails.mockRejectedValue(new Error("GitHub API rate limited"));

    const result = await runReviewJob(testCtx, testEnv);
    expect(result.success).toBe(false);
    expect(result.summary).toContain("rate limited");
  });
});
