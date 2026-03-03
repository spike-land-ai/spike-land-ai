import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetRoadmap, mockGetIssuesSummary, mockGetPRStatus } = vi.hoisted(
  () => ({
    mockGetRoadmap: vi.fn(),
    mockGetIssuesSummary: vi.fn(),
    mockGetPRStatus: vi.fn(),
  }),
);

vi.mock("@/lib/bridges/github-projects", () => ({
  getRoadmapItems: mockGetRoadmap,
  getIssuesSummary: mockGetIssuesSummary,
  getPRStatus: mockGetPRStatus,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerGitHubAdminTools } from "./github-admin";

describe("github admin tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GH_PAT_TOKEN", "test-token");
    registry = createMockRegistry();
    registerGitHubAdminTools(registry, "user-123");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 3 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("github_admin_roadmap")).toBe(true);
    expect(registry.handlers.has("github_admin_issues_summary")).toBe(true);
    expect(registry.handlers.has("github_admin_pr_status")).toBe(true);
  });

  describe("github_admin_roadmap", () => {
    it("should list roadmap items", async () => {
      mockGetRoadmap.mockResolvedValue([
        {
          id: "item-1",
          title: "Add MCP dashboard",
          status: "In Progress",
          type: "ISSUE",
          labels: ["feature", "p1"],
          assignees: ["zerdos"],
          url: "https://github.com/spike-land-ai/spike.land/issues/1",
        },
      ]);
      const handler = registry.handlers.get("github_admin_roadmap")!;
      const result = await handler({});
      expect(getText(result)).toContain("Add MCP dashboard");
      expect(getText(result)).toContain("In Progress");
      expect(getText(result)).toContain("feature, p1");
      expect(getText(result)).toContain("zerdos");
    });

    it("should handle items without labels or assignees", async () => {
      mockGetRoadmap.mockResolvedValue([
        {
          id: "item-2",
          title: "Draft idea",
          status: "No Status",
          type: "DRAFT_ISSUE",
          labels: [],
          assignees: [],
          url: null,
        },
      ]);
      const handler = registry.handlers.get("github_admin_roadmap")!;
      const result = await handler({});
      expect(getText(result)).toContain("Draft idea");
      expect(getText(result)).toContain("DRAFT_ISSUE");
    });

    it("should return empty message when no items found", async () => {
      mockGetRoadmap.mockResolvedValue([]);
      const handler = registry.handlers.get("github_admin_roadmap")!;
      const result = await handler({});
      expect(getText(result)).toContain("No roadmap items found");
    });

    it("should return empty message when API returns null", async () => {
      mockGetRoadmap.mockResolvedValue(null);
      const handler = registry.handlers.get("github_admin_roadmap")!;
      const result = await handler({});
      expect(getText(result)).toContain("No roadmap items found");
    });

    it("should show not-configured when GH_PAT_TOKEN is missing", async () => {
      vi.stubEnv("GH_PAT_TOKEN", "");
      delete process.env.GH_PAT_TOKEN;
      const handler = registry.handlers.get("github_admin_roadmap")!;
      const result = await handler({});
      expect(getText(result)).toContain("GitHub not configured");
    });
  });

  describe("github_admin_issues_summary", () => {
    it("should return issues summary", async () => {
      mockGetIssuesSummary.mockResolvedValue({
        open: 12,
        closed: 48,
        byLabel: { bug: 3, feature: 5 },
        recentlyUpdated: [
          {
            number: 42,
            title: "Fix auth bug",
            state: "OPEN",
            updatedAt: "2026-02-14T10:00:00Z",
          },
        ],
      });
      const handler = registry.handlers.get("github_admin_issues_summary")!;
      const result = await handler({});
      expect(getText(result)).toContain("Open: 12");
      expect(getText(result)).toContain("Closed: 48");
      expect(getText(result)).toContain("bug: 3");
      expect(getText(result)).toContain("feature: 5");
      expect(getText(result)).toContain("#42 Fix auth bug");
    });

    it("should handle summary with no labels", async () => {
      mockGetIssuesSummary.mockResolvedValue({
        open: 0,
        closed: 0,
        byLabel: {},
        recentlyUpdated: [],
      });
      const handler = registry.handlers.get("github_admin_issues_summary")!;
      const result = await handler({});
      expect(getText(result)).toContain("Open: 0");
      expect(getText(result)).not.toContain("By Label");
    });

    it("should return error when summary is null", async () => {
      mockGetIssuesSummary.mockResolvedValue(null);
      const handler = registry.handlers.get("github_admin_issues_summary")!;
      const result = await handler({});
      expect(getText(result)).toContain("Could not fetch issues summary");
    });

    it("should show not-configured when GH_PAT_TOKEN is missing", async () => {
      vi.stubEnv("GH_PAT_TOKEN", "");
      delete process.env.GH_PAT_TOKEN;
      const handler = registry.handlers.get("github_admin_issues_summary")!;
      const result = await handler({});
      expect(getText(result)).toContain("GitHub not configured");
    });
  });

  describe("github_admin_pr_status", () => {
    it("should return PR status", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 3,
        merged: 25,
        pending: [
          {
            number: 99,
            title: "feat: add dashboard",
            author: "zerdos",
            checksStatus: "SUCCESS",
            updatedAt: "2026-02-14T12:00:00Z",
          },
        ],
      });
      const handler = registry.handlers.get("github_admin_pr_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Open: 3");
      expect(getText(result)).toContain("Merged: 25");
      expect(getText(result)).toContain("#99 feat: add dashboard");
      expect(getText(result)).toContain("zerdos");
      expect(getText(result)).toContain("CI: SUCCESS");
    });

    it("should handle no pending PRs", async () => {
      mockGetPRStatus.mockResolvedValue({
        open: 0,
        merged: 10,
        pending: [],
      });
      const handler = registry.handlers.get("github_admin_pr_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Open: 0");
      expect(getText(result)).toContain("Merged: 10");
      expect(getText(result)).not.toContain("Pending PRs");
    });

    it("should return error when status is null", async () => {
      mockGetPRStatus.mockResolvedValue(null);
      const handler = registry.handlers.get("github_admin_pr_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Could not fetch PR status");
    });

    it("should show not-configured when GH_PAT_TOKEN is missing", async () => {
      vi.stubEnv("GH_PAT_TOKEN", "");
      delete process.env.GH_PAT_TOKEN;
      const handler = registry.handlers.get("github_admin_pr_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("GitHub not configured");
    });
  });
});
