import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

const mockGithubIssues = vi.hoisted(() => ({
  isGitHubAvailable: vi.fn(),
  listIssues: vi.fn(),
  createIssue: vi.fn(),
}));

vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));
vi.mock("@/lib/agents/github-issues", () => mockGithubIssues);
vi.mock("@/lib/try-catch", () => ({
  tryCatch: (p: Promise<unknown>) =>
    p.then(data => ({ data, error: null })).catch(error => ({
      data: null,
      error,
    })),
}));

import { triggerGitHubAlert } from "./404-alert";

describe("triggerGitHubAlert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns github_unavailable when GitHub is not configured", async () => {
    mockGithubIssues.isGitHubAvailable.mockReturnValue(false);

    const result = await triggerGitHubAlert("/admin/foo", "2026-02-18");

    expect(result).toEqual({ created: false, reason: "github_unavailable" });
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it("returns already_alerted when Redis dedup key exists", async () => {
    mockGithubIssues.isGitHubAvailable.mockReturnValue(true);
    mockRedis.get.mockResolvedValue("1");

    const result = await triggerGitHubAlert("/admin/foo", "2026-02-18");

    expect(result).toEqual({ created: false, reason: "already_alerted" });
    expect(mockGithubIssues.createIssue).not.toHaveBeenCalled();
  });

  it("returns issue_exists when open issue with same title already exists", async () => {
    mockGithubIssues.isGitHubAvailable.mockReturnValue(true);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockGithubIssues.listIssues.mockResolvedValue({
      data: [
        { title: "[404 Alert] Repeated 404 hits on /admin/foo", state: "open" },
      ],
      error: null,
    });

    const result = await triggerGitHubAlert("/admin/foo", "2026-02-18");

    expect(result).toEqual({ created: false, reason: "issue_exists" });
    expect(mockGithubIssues.createIssue).not.toHaveBeenCalled();
  });

  it("creates issue with correct title, body, and labels on happy path", async () => {
    mockGithubIssues.isGitHubAvailable.mockReturnValue(true);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockGithubIssues.listIssues.mockResolvedValue({ data: [], error: null });
    mockGithubIssues.createIssue.mockResolvedValue({
      data: {
        number: 42,
        title: "[404 Alert] Repeated 404 hits on /admin/foo",
      },
      error: null,
    });

    const result = await triggerGitHubAlert("/admin/foo", "2026-02-18");

    expect(result).toEqual({ created: true });
    expect(mockGithubIssues.createIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "[404 Alert] Repeated 404 hits on /admin/foo",
        labels: ["404-alert", "agent-created"],
      }),
    );
    // Verify body contains the URL and date
    const callBody = mockGithubIssues.createIssue.mock.calls[0]![0]!
      .body as string;
    expect(callBody).toContain("/admin/foo");
    expect(callBody).toContain("2026-02-18");
  });

  it("cleans up dedup key when GitHub API fails", async () => {
    mockGithubIssues.isGitHubAvailable.mockReturnValue(true);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
    mockGithubIssues.listIssues.mockResolvedValue({ data: [], error: null });
    mockGithubIssues.createIssue.mockResolvedValue({
      data: null,
      error: "API rate limited",
    });

    const result = await triggerGitHubAlert("/admin/foo", "2026-02-18");

    expect(result).toEqual({
      created: false,
      reason: "api_error: API rate limited",
    });
    expect(mockRedis.del).toHaveBeenCalledWith(
      "404:alerted:2026-02-18:/admin/foo",
    );
  });
});
