import { describe, expect, it, vi } from "vitest";
import { reviewPR } from "./review-pr.js";

const mockPRDetails = {
  title: "feat: test PR",
  body: "This is a well-documented PR with proper description explaining the motivation and approach in detail for the reviewer.",
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
  headRef: "feat/test",
};

const mockDiff = `--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;
--- a/src/foo.test.ts
+++ b/src/foo.test.ts
@@ -1 +1,2 @@
 test('x', () => {});
+test('y', () => {});`;

const mockFiles = [
  {
    filename: "src/foo.ts",
    status: "modified" as const,
    additions: 1,
    deletions: 0,
    patch: "@@ -1,2 +1,3 @@\n const x = 1;\n+const y = 2;",
    hunks: [],
  },
  {
    filename: "src/foo.test.ts",
    status: "modified" as const,
    additions: 1,
    deletions: 0,
    patch: "@@ -1 +1,2 @@\n test('x', () => {});\n+test('y', () => {});",
    hunks: [],
  },
];

const mockGetPRDetails = vi.hoisted(() => vi.fn());
const mockGetPRDiff = vi.hoisted(() => vi.fn());
const mockGetPRFiles = vi.hoisted(() => vi.fn());

vi.mock("../github/client.js", () => ({
  GitHubClient: class MockGitHubClient {
    getPRDetails = mockGetPRDetails;
    getPRDiff = mockGetPRDiff;
    getPRFiles = mockGetPRFiles;
  },
}));

describe("reviewPR", () => {
  it("returns gate results and review prompt for a clean PR", async () => {
    mockGetPRDetails.mockResolvedValue(mockPRDetails);
    mockGetPRDiff.mockResolvedValue(mockDiff);
    mockGetPRFiles.mockResolvedValue(mockFiles);

    const result = await reviewPR(
      { owner: "zerdos", repo: "test", prNumber: 1 },
      { githubToken: "fake-token" },
    );

    expect(result.gateResults).toContain("BAZDMEG Quality Gates");
    expect(result.reviewPrompt).toContain("feat: test PR");
    expect(result.decision).toBe("APPROVE");
  });

  it("suggests REQUEST_CHANGES when gates are RED", async () => {
    mockGetPRDetails.mockResolvedValue(mockPRDetails);
    mockGetPRDiff.mockResolvedValue(
      `+++ b/src/config.ts
@@ -0,0 +1 @@
+const password = "supersecret123";`,
    );
    mockGetPRFiles.mockResolvedValue([
      {
        filename: "src/config.ts",
        status: "added" as const,
        additions: 1,
        deletions: 0,
        patch: '@@ -0,0 +1 @@\n+const password = "supersecret123";',
        hunks: [],
      },
    ]);

    const result = await reviewPR(
      { owner: "zerdos", repo: "test", prNumber: 2 },
      { githubToken: "fake-token" },
    );

    expect(result.decision).toBe("REQUEST_CHANGES");
  });
});
