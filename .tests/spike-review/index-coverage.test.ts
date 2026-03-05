/**
 * Index.ts coverage tests
 *
 * Tests startServer, createServer tools, and all exports.
 * Targets uncovered lines in index.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock MCP server base
const mockTool = vi.fn();
const mockServer = { tool: mockTool };
const mockCreateMcpServer = vi.fn(() => mockServer);
const mockStartMcpServer = vi.fn().mockResolvedValue(undefined);

vi.mock("@spike-land-ai/mcp-server-base", () => ({
  createMcpServer: mockCreateMcpServer,
  startMcpServer: mockStartMcpServer,
  registerFeedbackTool: vi.fn(),
  createErrorShipper: vi.fn(() => ({
    shipError: vi.fn(),
  })),
}));

// Mock Octokit
vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    rest = {
      pulls: {
        get: vi.fn(),
        listFiles: vi.fn(),
        createReview: vi.fn(),
      },
      checks: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };
  },
}));

const { createServer, startServer } = await import("../../src/spike-review/index.js");

describe("createServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMcpServer.mockReturnValue(mockServer);
  });

  it("creates and returns a server", () => {
    const server = createServer("test-token");
    expect(server).toBe(mockServer);
  });

  it("registers all expected tools", () => {
    createServer("test-token");
    const toolNames = mockTool.mock.calls.map((call) => call[0]);
    expect(toolNames).toContain("review_pr");
    expect(toolNames).toContain("check_bazdmeg_gates");
    expect(toolNames).toContain("get_pr_details");
    expect(toolNames).toContain("get_pr_files");
    expect(toolNames).toContain("submit_review");
    expect(toolNames).toContain("validate_comment_target");
    expect(toolNames).toContain("post_check_run");
    expect(toolNames).toContain("review_diff");
  });

  it("registers 8 tools total", () => {
    createServer("test-token");
    expect(mockTool.mock.calls).toHaveLength(8);
  });
});

describe("tool handlers", () => {
  let toolHandlers: Record<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateMcpServer.mockReturnValue({
      tool: (name: string, _desc: string, _schema: unknown, handler: unknown) => {
        toolHandlers[name] = handler as (...args: unknown[]) => Promise<unknown>;
      },
    });
    toolHandlers = {};
    createServer("test-token");
  });

  describe("check_bazdmeg_gates handler", () => {
    it("calls checkBazdmegGates and returns text content", async () => {
      const handler = toolHandlers["check_bazdmeg_gates"];
      expect(handler).toBeDefined();

      const result = (await handler!({ diff: "+const x = 1;", claudeMdContent: "" })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content[0]!.type).toBe("text");
      expect(typeof result.content[0]!.text).toBe("string");
    });

    it("handles diff with content", async () => {
      const handler = toolHandlers["check_bazdmeg_gates"];
      const result = (await handler!({
        diff: "+const x: any = 1;\n-const y = 2;",
        claudeMdContent: "# Rules\n- No any types",
      })) as { content: Array<{ type: string; text: string }> };

      expect(result.content[0]!.type).toBe("text");
    });
  });

  describe("review_diff handler", () => {
    it("processes a simple diff", async () => {
      const handler = toolHandlers["review_diff"];
      expect(handler).toBeDefined();

      const diff = `--- a/src/test.ts
+++ b/src/test.ts
@@ -1,3 +1,5 @@
 import { foo } from './foo.js';
+import { bar } from './bar.js';
+
 export function main() {
-  return foo();
+  return bar(foo());
 }`;

      const result = (await handler!({ diff, context: "Test context", rules: ["No any"] })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content[0]!.type).toBe("text");
      expect(result.content[0]!.text).toContain("Review Prompt");
    });

    it("handles diff with no context or rules", async () => {
      const handler = toolHandlers["review_diff"];
      const result = (await handler!({ diff: "+const x = 1;" })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content[0]!.type).toBe("text");
    });

    it("counts additions and deletions", async () => {
      const handler = toolHandlers["review_diff"];
      const diff = `--- a/f.ts\n+++ b/f.ts\n@@ -1,2 +1,3 @@\n+added line\n kept line\n-removed line`;

      const result = (await handler!({ diff })) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(result.content[0]!.text).toBeDefined();
    });
  });

  describe("get_pr_details handler", () => {
    it("calls github.getPRDetails and returns JSON", async () => {
      const mockGetPRDetails = vi.fn().mockResolvedValue({
        title: "Test PR",
        body: "PR body",
        author: "testuser",
        additions: 10,
        deletions: 5,
        changedFiles: 2,
        headSha: "abc123",
        baseSha: "def456",
        baseRef: "main",
        headRef: "feature",
        state: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        mergeable: true,
        merged: false,
      });

      // Need to re-setup with a controllable GitHub client
      const { GitHubClient } = await import("../../src/spike-review/github/client.js");
      const origGetPRDetails = GitHubClient.prototype.getPRDetails;
      GitHubClient.prototype.getPRDetails = mockGetPRDetails;

      // Recreate server with fresh mocks
      const freshHandlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
      mockCreateMcpServer.mockReturnValue({
        tool: (name: string, _desc: string, _schema: unknown, handler: unknown) => {
          freshHandlers[name] = handler as (...args: unknown[]) => Promise<unknown>;
        },
      });

      createServer("test-token");

      const handler = freshHandlers["get_pr_details"];
      const result = (await handler!({ owner: "org", repo: "repo", prNumber: 1 })) as {
        content: Array<{ type: string; text: string }>;
      };

      expect(result.content[0]!.type).toBe("text");
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.title).toBe("Test PR");

      GitHubClient.prototype.getPRDetails = origGetPRDetails;
    });
  });

  describe("validate_comment_target handler - file not found", () => {
    it("returns invalid when file not in PR", async () => {
      const mockGetPRFiles = vi.fn().mockResolvedValue([
        { filename: "src/other.ts", status: "modified", additions: 1, deletions: 0, patch: "", hunks: [] },
      ]);

      const { GitHubClient } = await import("../../src/spike-review/github/client.js");
      const origGetPRFiles = GitHubClient.prototype.getPRFiles;
      GitHubClient.prototype.getPRFiles = mockGetPRFiles;

      const freshHandlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
      mockCreateMcpServer.mockReturnValue({
        tool: (name: string, _desc: string, _schema: unknown, handler: unknown) => {
          freshHandlers[name] = handler as (...args: unknown[]) => Promise<unknown>;
        },
      });
      createServer("test-token");

      const handler = freshHandlers["validate_comment_target"];
      const result = (await handler!({
        owner: "org",
        repo: "repo",
        prNumber: 1,
        path: "src/notfound.ts",
        line: 5,
        side: "RIGHT",
      })) as { content: Array<{ type: string; text: string }> };

      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.valid).toBe(false);
      expect(parsed.reason).toContain("not found in PR diff");

      GitHubClient.prototype.getPRFiles = origGetPRFiles;
    });
  });
});

describe("startServer", () => {
  it("exits with error when GITHUB_TOKEN is not set", async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;

    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
    const mockConsoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      await startServer();
    } catch (e) {
      expect((e as Error).message).toBe("process.exit called");
    }

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("GITHUB_TOKEN"),
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    if (originalToken) {
      process.env.GITHUB_TOKEN = originalToken;
    }
  });

  it("calls startMcpServer when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "test-token-value";

    // Reset the mock to return a consistent server object
    const freshServer = { tool: vi.fn() };
    mockCreateMcpServer.mockReturnValue(freshServer);
    mockStartMcpServer.mockClear();

    await startServer();

    expect(mockStartMcpServer).toHaveBeenCalledTimes(1);
    expect(mockStartMcpServer).toHaveBeenCalledWith(freshServer);

    delete process.env.GITHUB_TOKEN;
  });
});
