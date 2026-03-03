import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerGitHubIssueSearchTools } from "./github-issue-search";

describe("github issue search tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GH_PAT_TOKEN", "test-token");
    registry = createMockRegistry();
    registerGitHubIssueSearchTools(registry, "user-123");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("registers 1 tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
    expect(registry.handlers.has("github_issue_search")).toBe(true);
  });

  describe("github_issue_search", () => {
    it("should return matching issues", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 2,
          items: [
            {
              number: 42,
              title: "Fix authentication bug",
              state: "open",
              labels: [{ name: "bug" }, { name: "p1" }],
              created_at: "2026-02-10T10:00:00Z",
              html_url: "https://github.com/spike-land-ai/spike.land/issues/42",
            },
            {
              number: 15,
              title: "Auth session timeout",
              state: "closed",
              labels: [{ name: "feature" }],
              created_at: "2026-01-20T08:00:00Z",
              html_url: "https://github.com/spike-land-ai/spike.land/issues/15",
            },
          ],
        }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "auth" });
      const text = getText(result);

      expect(text).toContain("Found 2 issue(s)");
      expect(text).toContain("#42");
      expect(text).toContain("Fix authentication bug");
      expect(text).toContain("open");
      expect(text).toContain("bug, p1");
      expect(text).toContain("2026-02-10");
      expect(text).toContain("#15");
      expect(text).toContain("Auth session timeout");
      expect(text).toContain("closed");
      expect(text).toContain("feature");
    });

    it("should return empty message when no issues found", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 0,
          items: [],
        }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "nonexistent-xyz" });
      const text = getText(result);

      expect(text).toContain("No issues found");
      expect(text).toContain("nonexistent-xyz");
    });

    it("should pass state filter to API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, items: [] }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      await handler({ query: "bug", state: "open" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("state:open");
    });

    it("should not add state filter when state is 'all'", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, items: [] }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      await handler({ query: "bug", state: "all" });

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).not.toContain("state:");
    });

    it("should respect limit parameter", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, items: [] }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      await handler({ query: "test", limit: 5 });

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("per_page=5");
    });

    it("should use default limit of 10", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, items: [] }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      await handler({ query: "test" });

      const calledUrl = mockFetch.mock.calls[0]![0] as string;
      expect(calledUrl).toContain("per_page=10");
    });

    it("should send correct authorization header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ total_count: 0, items: [] }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      await handler({ query: "test" });

      const calledHeaders = mockFetch.mock.calls[0]![1] as {
        headers: Record<string, string>;
      };
      expect(calledHeaders.headers.Authorization).toBe("Bearer test-token");
      expect(calledHeaders.headers.Accept).toBe(
        "application/vnd.github.v3+json",
      );
    });

    it("should handle issues with no labels", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          total_count: 1,
          items: [
            {
              number: 99,
              title: "Simple issue",
              state: "open",
              labels: [],
              created_at: "2026-02-15T12:00:00Z",
              html_url: "https://github.com/spike-land-ai/spike.land/issues/99",
            },
          ],
        }),
      });

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "simple" });
      const text = getText(result);

      expect(text).toContain("#99");
      expect(text).toContain("Simple issue");
      expect(text).not.toContain("[");
    });

    it("should show not-configured when GH_PAT_TOKEN is missing", async () => {
      vi.stubEnv("GH_PAT_TOKEN", "");
      delete process.env.GH_PAT_TOKEN;

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "test" });
      const text = getText(result);

      expect(text).toContain("GitHub not configured");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle GitHub API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "API rate limit exceeded",
      });

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "test" });

      expect(isError(result)).toBe(true);
    });

    it("should handle GitHub API error when response.text() also fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error("body read error");
        },
      });

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "test" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unknown error");
    });

    it("should handle fetch exceptions", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      const handler = registry.handlers.get("github_issue_search")!;
      const result = await handler({ query: "test" });

      expect(isError(result)).toBe(true);
    });
  });
});
