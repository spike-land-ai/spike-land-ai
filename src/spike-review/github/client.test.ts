import { describe, expect, it, vi } from "vitest";
import { GitHubClient, parseDiffHunks } from "./client.js";

// Mock Octokit — shared mock functions for all instances
const mockPullsGet = vi.hoisted(() => vi.fn());
const mockPullsListFiles = vi.hoisted(() => vi.fn());
const mockPullsCreateReview = vi.hoisted(() => vi.fn());
const mockChecksCreate = vi.hoisted(() => vi.fn());
const mockChecksUpdate = vi.hoisted(() => vi.fn());

vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    rest = {
      pulls: {
        get: mockPullsGet,
        listFiles: mockPullsListFiles,
        createReview: mockPullsCreateReview,
      },
      checks: {
        create: mockChecksCreate,
        update: mockChecksUpdate,
      },
    };
  },
}));

describe("parseDiffHunks", () => {
  it("parses a single hunk", () => {
    const patch = `@@ -1,3 +1,4 @@
 unchanged
+added line
 unchanged
 unchanged`;

    const hunks = parseDiffHunks(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.oldStart).toBe(1);
    expect(hunks[0]?.oldLines).toBe(3);
    expect(hunks[0]?.newStart).toBe(1);
    expect(hunks[0]?.newLines).toBe(4);
    expect(hunks[0]?.lines).toHaveLength(5);
  });

  it("parses multiple hunks", () => {
    const patch = `@@ -1,3 +1,4 @@
 line1
+added
 line2
@@ -10,2 +11,3 @@
 line10
+another
 line11`;

    const hunks = parseDiffHunks(patch);
    expect(hunks).toHaveLength(2);
    expect(hunks[0]?.newStart).toBe(1);
    expect(hunks[1]?.newStart).toBe(11);
  });

  it("handles hunks with missing line counts (defaults to 1)", () => {
    const patch = `@@ -5 +5,2 @@
 context
+new`;

    const hunks = parseDiffHunks(patch);
    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.oldLines).toBe(1);
    expect(hunks[0]?.newLines).toBe(2);
  });

  it("returns empty array for empty patch", () => {
    expect(parseDiffHunks("")).toHaveLength(0);
  });
});

describe("GitHubClient", () => {
  describe("getPRDetails", () => {
    it("fetches and maps PR details", async () => {
      mockPullsGet.mockResolvedValueOnce({
        data: {
          title: "Test PR",
          body: "Description",
          state: "open",
          user: { login: "testuser" },
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          mergeable: true,
          merged: false,
          additions: 10,
          deletions: 5,
          changed_files: 2,
          head: { sha: "abc123", ref: "feat/test" },
          base: { sha: "def456", ref: "main" },
        },
      });

      const client = new GitHubClient({ token: "test" });
      const details = await client.getPRDetails("owner", "repo", 1);
      expect(details.title).toBe("Test PR");
      expect(details.author).toBe("testuser");
      expect(details.headSha).toBe("abc123");
      expect(details.baseRef).toBe("main");
    });
  });

  describe("getPRDiff", () => {
    it("fetches diff as string", async () => {
      mockPullsGet.mockResolvedValueOnce({ data: "+diff content" });

      const client = new GitHubClient({ token: "test" });
      const diff = await client.getPRDiff("owner", "repo", 1);
      expect(diff).toBe("+diff content");
    });
  });

  describe("getPRFiles", () => {
    it("fetches and parses files with hunks", async () => {
      mockPullsListFiles.mockResolvedValueOnce({
        data: [
          {
            filename: "src/foo.ts",
            status: "modified",
            additions: 1,
            deletions: 0,
            patch: "@@ -1,2 +1,3 @@\n const x = 1;\n+const y = 2;",
          },
        ],
      });

      const client = new GitHubClient({ token: "test" });
      const files = await client.getPRFiles("owner", "repo", 1);
      expect(files).toHaveLength(1);
      expect(files[0]?.filename).toBe("src/foo.ts");
      expect(files[0]?.hunks).toHaveLength(1);
    });

    it("handles files without patch (binary)", async () => {
      mockPullsListFiles.mockResolvedValueOnce({
        data: [
          {
            filename: "image.png",
            status: "added",
            additions: 0,
            deletions: 0,
          },
        ],
      });

      const client = new GitHubClient({ token: "test" });
      const files = await client.getPRFiles("owner", "repo", 1);
      expect(files[0]?.hunks).toHaveLength(0);
    });
  });

  describe("submitReview", () => {
    it("submits a review and returns id", async () => {
      mockPullsCreateReview.mockResolvedValueOnce({ data: { id: 42 } });

      const client = new GitHubClient({ token: "test" });
      const result = await client.submitReview("owner", "repo", 1, {
        body: "LGTM",
        event: "APPROVE",
        commitId: "abc123",
        comments: [{ path: "src/foo.ts", line: 10, body: "Nit" }],
      });
      expect(result.id).toBe(42);
    });

    it("submits without comments", async () => {
      mockPullsCreateReview.mockResolvedValueOnce({ data: { id: 43 } });

      const client = new GitHubClient({ token: "test" });
      const result = await client.submitReview("owner", "repo", 1, {
        body: "Looks good",
        event: "COMMENT",
        commitId: "abc",
      });
      expect(result.id).toBe(43);
    });
  });

  describe("createCheckRun", () => {
    it("creates a check run", async () => {
      mockChecksCreate.mockResolvedValueOnce({ data: { id: 99 } });

      const client = new GitHubClient({ token: "test" });
      const result = await client.createCheckRun("owner", "repo", {
        name: "Spike Review",
        headSha: "abc123",
        status: "completed",
        conclusion: "success",
        summary: "All good",
      });
      expect(result.id).toBe(99);
    });
  });

  describe("updateCheckRun", () => {
    it("updates a check run", async () => {
      mockChecksUpdate.mockResolvedValueOnce({});

      const client = new GitHubClient({ token: "test" });
      await expect(
        client.updateCheckRun("owner", "repo", 99, {
          status: "completed",
          conclusion: "success",
          summary: "Updated",
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe("validateCommentTarget", () => {
    const client = new GitHubClient({ token: "fake-token" });

    it("returns valid for line within hunk", () => {
      const hunks = [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [] }];
      const result = client.validateCommentTarget(hunks, 2);
      expect(result.valid).toBe(true);
    });

    it("returns invalid for line outside hunk", () => {
      const hunks = [{ oldStart: 1, oldLines: 3, newStart: 1, newLines: 4, lines: [] }];
      const result = client.validateCommentTarget(hunks, 10);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not within any diff hunk");
    });

    it("returns nearest valid line when target is invalid", () => {
      const hunks = [{ oldStart: 10, oldLines: 5, newStart: 10, newLines: 5, lines: [] }];
      const result = client.validateCommentTarget(hunks, 20);
      expect(result.valid).toBe(false);
      expect(result.nearestValidLine?.line).toBe(14);
    });

    it("validates on LEFT side", () => {
      const hunks = [{ oldStart: 5, oldLines: 3, newStart: 5, newLines: 4, lines: [] }];
      const result = client.validateCommentTarget(hunks, 6, "LEFT" as const);
      expect(result.valid).toBe(true);
    });

    it("handles empty hunks array", () => {
      const result = client.validateCommentTarget([], 5);
      expect(result.valid).toBe(false);
    });
  });
});
