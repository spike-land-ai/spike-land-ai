/**
 * Test review_pr tool handler in index.ts
 *
 * Mocks the reviewPR function to exercise lines 46-51.
 */

import { describe, expect, it, vi } from "vitest";

// Mock reviewPR
const mockReviewPR = vi.fn();

vi.mock("../../src/spike-review/tools/review-pr.js", () => ({
  reviewPR: mockReviewPR,
}));

vi.mock("@octokit/rest", () => ({
  Octokit: class MockOctokit {
    rest = {
      pulls: { get: vi.fn(), listFiles: vi.fn(), createReview: vi.fn() },
      checks: { create: vi.fn(), update: vi.fn() },
    };
  },
}));

const capturedHandlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

vi.mock("@spike-land-ai/mcp-server-base", () => ({
  createMcpServer: vi.fn(() => ({
    tool: (name: string, _desc: string, _schema: unknown, handler: unknown) => {
      capturedHandlers[name] = handler as (...args: unknown[]) => Promise<unknown>;
    },
  })),
  startMcpServer: vi.fn(),
  registerFeedbackTool: vi.fn(),
  createErrorShipper: vi.fn(() => ({
    shipError: vi.fn(),
  })),
}));

const { createServer } = await import("../../src/spike-review/index.js");
createServer("test-token");

describe("review_pr tool handler (lines 46-51)", () => {
  it("calls reviewPR and formats the output with gate results and decision", async () => {
    mockReviewPR.mockResolvedValue({
      gateResults: "## BAZDMEG Quality Gates ✅\n\nAll gates GREEN",
      reviewPrompt: "Please review this PR carefully.",
      decision: "APPROVE",
    });

    const handler = capturedHandlers["review_pr"];
    expect(handler).toBeDefined();

    const result = (await handler!({
      owner: "org",
      repo: "my-repo",
      prNumber: 42,
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]!.type).toBe("text");
    const text = result.content[0]!.text;
    expect(text).toContain("BAZDMEG Quality Gates");
    expect(text).toContain("Review Prompt");
    expect(text).toContain("APPROVE");
    expect(mockReviewPR).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "org", repo: "my-repo", prNumber: 42 }),
      expect.objectContaining({ githubToken: "test-token" }),
    );
  });

  it("passes customPrompt and rulesPath when provided", async () => {
    mockReviewPR.mockResolvedValue({
      gateResults: "Gates output",
      reviewPrompt: "Custom review prompt",
      decision: "COMMENT",
    });

    const handler = capturedHandlers["review_pr"];
    await handler!({
      owner: "org",
      repo: "repo",
      prNumber: 1,
      customPrompt: "Be strict",
      rulesPath: ".spike-review.yaml",
    });

    expect(mockReviewPR).toHaveBeenCalledWith(
      expect.objectContaining({
        customPrompt: "Be strict",
        rulesPath: ".spike-review.yaml",
      }),
      expect.anything(),
    );
  });

  it("formats REQUEST_CHANGES decision", async () => {
    mockReviewPR.mockResolvedValue({
      gateResults: "Gates: RED",
      reviewPrompt: "Security issue detected.",
      decision: "REQUEST_CHANGES",
    });

    const handler = capturedHandlers["review_pr"];
    const result = (await handler!({
      owner: "org",
      repo: "repo",
      prNumber: 2,
    })) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]!.text).toContain("REQUEST_CHANGES");
  });
});
