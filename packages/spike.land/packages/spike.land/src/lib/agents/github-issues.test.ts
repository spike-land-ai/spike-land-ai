import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

import {
  createIssue,
  getWorkflowRuns,
  isGitHubAvailable,
  listIssues,
} from "./github-issues";

describe("github-issues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("GH_PAT_TOKEN", "test-token");
    vi.stubEnv("GITHUB_OWNER", "testowner");
    vi.stubEnv("GITHUB_REPO", "testrepo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockFetchSuccess(data: unknown, status = 200) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
  }

  describe("isGitHubAvailable", () => {
    it("should return true when token is set", () => {
      expect(isGitHubAvailable()).toBe(true);
    });

    it("should return false when token is not set", () => {
      vi.stubEnv("GH_PAT_TOKEN", "");
      expect(isGitHubAvailable()).toBe(false);
    });
  });

  describe("listIssues", () => {
    it("should build URL with filters and transform API response", async () => {
      const apiIssues = [
        {
          number: 1,
          title: "Bug fix",
          state: "open",
          labels: [{ name: "bug" }],
          user: { login: "testuser" },
          assignees: [{ login: "dev1" }],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-02T00:00:00Z",
          html_url: "https://github.com/testowner/testrepo/issues/1",
          body: "Description",
        },
      ];
      mockFetchSuccess(apiIssues);

      const result = await listIssues({
        state: "open",
        labels: "bug",
        limit: 5,
      });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      const issue = result.data![0]!;
      expect(issue.number).toBe(1);
      expect(issue.title).toBe("Bug fix");
      expect(issue.labels).toEqual(["bug"]);
      expect(issue.author).toBe("testuser");
      expect(issue.assignees).toEqual(["dev1"]);

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("/repos/testowner/testrepo/issues");
      expect(url).toContain("state=open");
      expect(url).toContain("labels=bug");
      expect(url).toContain("per_page=5");
    });

    it("should use default values when no options", async () => {
      mockFetchSuccess([]);

      await listIssues();

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("state=open");
      expect(url).toContain("per_page=20");
    });

    it("should use default owner/repo when env vars missing", async () => {
      vi.stubEnv("GITHUB_OWNER", "");
      vi.stubEnv("GITHUB_REPO", "");
      mockFetchSuccess([]);

      await listIssues();

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("/repos/spike-land-ai/spike.land/");
    });
  });

  describe("createIssue", () => {
    it("should POST with title/body/labels and transform response", async () => {
      const apiIssue = {
        number: 42,
        title: "New feature",
        state: "open",
        labels: [{ name: "feature" }],
        user: { login: "creator" },
        assignees: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        html_url: "https://github.com/testowner/testrepo/issues/42",
        body: "Feature body",
      };
      mockFetchSuccess(apiIssue);

      const result = await createIssue({
        title: "New feature",
        body: "Feature body",
        labels: ["feature"],
      });

      expect(result.error).toBeNull();
      expect(result.data!.number).toBe(42);
      expect(result.data!.title).toBe("New feature");
      expect(result.data!.labels).toEqual(["feature"]);

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]!;
      expect(fetchCall[1].method).toBe("POST");
      const body = JSON.parse(fetchCall[1].body);
      expect(body.title).toBe("New feature");
      expect(body.labels).toEqual(["feature"]);
    });
  });

  describe("getWorkflowRuns", () => {
    it("should fetch runs and transform response", async () => {
      const apiRuns = {
        workflow_runs: [
          {
            id: 100,
            name: "CI",
            status: "completed",
            conclusion: "success",
            head_branch: "main",
            event: "push",
            created_at: "2024-01-01T00:00:00Z",
            html_url: "https://github.com/testowner/testrepo/actions/runs/100",
          },
        ],
      };
      mockFetchSuccess(apiRuns);

      const result = await getWorkflowRuns({ limit: 5 });

      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      const run = result.data![0]!;
      expect(run.id).toBe(100);
      expect(run.name).toBe("CI");
      expect(run.branch).toBe("main");
      expect(run.url).toContain("actions/runs/100");
    });
  });

  describe("error handling", () => {
    it("should return error when token is missing", async () => {
      vi.stubEnv("GH_PAT_TOKEN", "");

      const result = await listIssues();

      expect(result.data).toBeNull();
      expect(result.error).toBe("GH_PAT_TOKEN is not configured");
    });

    it("should handle network errors", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Connection refused"),
      );

      const result = await listIssues();

      expect(result.data).toBeNull();
      expect(result.error).toContain("Network error");
    });

    it("should handle API errors", async () => {
      mockFetchSuccess({ message: "Not Found" }, 404);

      const result = await listIssues();

      expect(result.data).toBeNull();
      expect(result.error).toBe("Not Found");
    });

    it("should handle JSON parse errors", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Bad JSON")),
      });

      const result = await listIssues();

      expect(result.data).toBeNull();
      expect(result.error).toContain("Failed to parse");
    });
  });
});
