import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetWorkflowRuns, mockGetPRStatus } = vi.hoisted(() => ({
  mockGetWorkflowRuns: vi.fn(),
  mockGetPRStatus: vi.fn(),
}));

const { mockRedisPing } = vi.hoisted(() => ({
  mockRedisPing: vi.fn(),
}));

const { mockPrismaQueryRaw } = vi.hoisted(() => ({
  mockPrismaQueryRaw: vi.fn(),
}));

vi.mock("@/lib/agents/github-issues", () => ({
  getWorkflowRuns: mockGetWorkflowRuns,
}));

vi.mock("@/lib/bridges/github-projects", () => ({
  getPRStatus: mockGetPRStatus,
}));

vi.mock("@/lib/upstash/client", () => ({
  redis: { ping: mockRedisPing },
}));

vi.mock("@/lib/prisma", () => ({
  default: { $queryRaw: mockPrismaQueryRaw },
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegTools } from "./bazdmeg";

describe("bazdmeg quality gate tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBazdmegTools(registry, "user-123");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 3 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("bazdmeg_quality_gates")).toBe(true);
    expect(registry.handlers.has("bazdmeg_pr_readiness")).toBe(true);
    expect(registry.handlers.has("bazdmeg_deploy_check")).toBe(true);
  });

  describe("bazdmeg_quality_gates", () => {
    it("should return GREEN when all checks pass", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
          {
            id: 2,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("BAZDMEG Quality Gates");
      expect(text).toContain("[GREEN]");
      expect(text).toContain("Overall: GREEN");
    });

    it("should return YELLOW when CI is stale (>5m)", async () => {
      const fiveMinsAgo = new Date(Date.now() - 6 * 60_000).toISOString();
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: fiveMinsAgo,
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      expect(getText(result)).toContain("[YELLOW]");
      expect(getText(result)).toContain("Last CI completed 6m ago");
    });

    it("should return YELLOW when CI is very stale (>10m)", async () => {
      const elevenMinsAgo = new Date(Date.now() - 11 * 60_000).toISOString();
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: elevenMinsAgo,
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      expect(getText(result)).toContain("may be stale");
    });

    it("should return RED when CI is failing", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
          {
            id: 2,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
          {
            id: 3,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("[RED]");
      expect(text).toContain("Overall: RED");
    });

    it("should return RED when no workflow runs available", async () => {
      mockGetWorkflowRuns.mockResolvedValue({ data: null, error: "no token" });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("[RED]");
      expect(text).toContain("No workflow runs found");
    });

    it("should show YELLOW for Test Health when 1 run failed", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
          {
            id: 2,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
          {
            id: 3,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Test Health");
      expect(text).toContain("[YELLOW]");
      expect(text).toContain("1/3 recent runs failed");
    });

    it("should show YELLOW for Type Safety when Redis fails", async () => {
      mockGetWorkflowRuns.mockResolvedValue({ data: [], error: null });
      mockRedisPing.mockRejectedValue(new Error("Redis down"));

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      expect(getText(result)).toContain("Type Safety");
      expect(getText(result)).toContain("YELLOW");
      expect(getText(result)).toContain("Redis unavailable");
    });

    it("should show YELLOW for Type Safety when Redis is slow", async () => {
      vi.useFakeTimers();
      mockGetWorkflowRuns.mockResolvedValue({ data: [], error: null });
      mockRedisPing.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 3001));
        return "PONG";
      });

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const promise = handler({});
      await vi.advanceTimersByTimeAsync(3100);
      const result = await promise;
      expect(getText(result)).toContain("Type Safety");
      expect(getText(result)).toContain("YELLOW");
      vi.useRealTimers();
    });

    it("should show RED for Coverage when no successful CI exists", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockRedisPing.mockResolvedValue("PONG");

      const handler = registry.handlers.get("bazdmeg_quality_gates")!;
      const result = await handler({});
      expect(getText(result)).toContain("Coverage");
      expect(getText(result)).toContain("RED");
    });
  });

  describe("bazdmeg_pr_readiness", () => {
    it("should show ready PR when all checks pass", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 10,
        pending: [
          {
            number: 42,
            title: "feat: add auth (#15)",
            author: "zerdos",
            checksStatus: "SUCCESS",
            reviewDecision: "APPROVED",
            isDraft: false,
            updatedAt: "2026-02-14T12:00:00Z",
          },
        ],
      });

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({ pr_number: 42 });
      const text = getText(result);
      expect(text).toContain("PR #42");
      expect(text).toContain("[PASS]");
      expect(text).toContain("Ready to merge");
    });

    it("should show blocked PR when CI fails", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 10,
        pending: [
          {
            number: 99,
            title: "fix: something",
            author: "dev",
            checksStatus: "FAILURE",
            reviewDecision: "NONE",
            isDraft: false,
            updatedAt: "2026-02-14T12:00:00Z",
          },
        ],
      });

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("PR #99");
      expect(text).toContain("[FAIL]");
      expect(text).toContain("Blocked by");
    });

    it("should show draft PRs as not ready", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 0,
        pending: [
          {
            number: 5,
            title: "WIP: feature (#10)",
            author: "dev",
            checksStatus: "SUCCESS",
            reviewDecision: "APPROVED",
            isDraft: true,
            updatedAt: "2026-02-14T12:00:00Z",
          },
        ],
      });

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("[FAIL]");
      expect(text).toContain("Not Draft");
    });

    it("should handle no open PRs", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 0,
        merged: 5,
        pending: [],
      });

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("No open PRs");
    });

    it("should handle specific PR not found", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 5,
        pending: [{
          number: 1,
          title: "test",
          author: "dev",
          checksStatus: "SUCCESS",
          reviewDecision: "APPROVED",
          isDraft: false,
          updatedAt: "",
        }],
      });

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({ pr_number: 999 });
      expect(getText(result)).toContain("PR #999 not found");
    });

    it("should handle null PR status", async () => {
      mockGetPRStatus.mockResolvedValue(null);

      const handler = registry.handlers.get("bazdmeg_pr_readiness")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Could not fetch PR status");
    });
  });

  describe("bazdmeg_deploy_check", () => {
    it("should return DEPLOY_READY when all checks pass", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 10,
        pending: [
          {
            number: 1,
            title: "test",
            author: "dev",
            checksStatus: "SUCCESS",
            reviewDecision: "APPROVED",
            isDraft: false,
            updatedAt: "",
          },
        ],
      });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("DEPLOY_READY");
      expect(text).toContain("Safe to deploy");
    });

    it("should return DEPLOY_BLOCKED when main CI fails", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "failure",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "http://ci",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("DEPLOY_BLOCKED");
      expect(text).toContain("FAILED");
    });

    it("should return DEPLOY_BLOCKED when main CI is in progress", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "in_progress",
            conclusion: null,
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      expect(getText(result)).toContain("CI still running");
    });

    it("should block when no recent main CI exists", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "feat",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      expect(getText(result)).toContain(
        "No recent CI runs found for main branch",
      );
    });

    it("should block when database is down", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockRejectedValue(new Error("Connection refused"));

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("DEPLOY_BLOCKED");
      expect(text).toContain("Database connection failed");
    });

    it("should block when database latency is high", async () => {
      vi.useFakeTimers();
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 3001));
        return [{ 1: 1 }];
      });

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const promise = handler({});
      await vi.advanceTimersByTimeAsync(3100);
      const result = await promise;
      expect(getText(result)).toContain("Database latency high");
      vi.useRealTimers();
    });

    it("should block when GitHub is unavailable (empty runs)", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({ open: 0, merged: 0, pending: [] });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Cannot fetch CI runs");
    });

    it("should block when PRs have failing CI", async () => {
      mockGetWorkflowRuns.mockResolvedValue({
        data: [
          {
            id: 1,
            name: "CI",
            status: "completed",
            conclusion: "success",
            branch: "main",
            event: "push",
            createdAt: new Date().toISOString(),
            url: "",
          },
        ],
        error: null,
      });
      mockGetPRStatus.mockResolvedValue({
        open: 1,
        merged: 0,
        pending: [
          {
            number: 55,
            title: "broken PR",
            author: "dev",
            checksStatus: "FAILURE",
            reviewDecision: "NONE",
            isDraft: false,
            updatedAt: "",
          },
        ],
      });
      mockPrismaQueryRaw.mockResolvedValue([{ 1: 1 }]);

      const handler = registry.handlers.get("bazdmeg_deploy_check")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("DEPLOY_BLOCKED");
      expect(text).toContain("PR #55 has failing CI");
    });
  });
});
