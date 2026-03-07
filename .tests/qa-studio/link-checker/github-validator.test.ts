import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedLink } from "../../../src/core/browser-automation/core-logic/link-checker/types.js";
import {
  parseGitHubUrl,
  parseShieldsBadge,
  validateGitHubUrl,
} from "../../../src/core/browser-automation/core-logic/link-checker/github-validator.js";

function makeLink(target: string): ExtractedLink {
  return {
    target,
    text: "test",
    line: 1,
    column: 1,
    category: "github_repo",
    inCodeBlock: false,
    inComment: false,
  };
}

describe("parseGitHubUrl", () => {
  it("parses repo URLs", () => {
    const parsed = parseGitHubUrl("https://github.com/spike-land-ai/chess-engine");
    expect(parsed).toMatchObject({
      org: "spike-land-ai",
      repo: "chess-engine",
      type: "repo",
    });
  });

  it("parses blob URLs", () => {
    const parsed = parseGitHubUrl("https://github.com/org/repo/blob/main/src/index.ts");
    expect(parsed).toMatchObject({
      org: "org",
      repo: "repo",
      type: "file",
      branch: "main",
      path: "src/index.ts",
    });
  });

  it("parses tree URLs", () => {
    const parsed = parseGitHubUrl("https://github.com/org/repo/tree/main/src");
    expect(parsed).toMatchObject({
      org: "org",
      repo: "repo",
      type: "tree",
      branch: "main",
      path: "src",
    });
  });

  it("parses raw.githubusercontent.com URLs", () => {
    const parsed = parseGitHubUrl("https://raw.githubusercontent.com/org/repo/main/logo.svg");
    expect(parsed).toMatchObject({
      org: "org",
      repo: "repo",
      type: "raw",
      branch: "main",
      path: "logo.svg",
    });
  });

  it("returns null for non-GitHub URLs", () => {
    expect(parseGitHubUrl("https://example.com/page")).toBeNull();
  });

  it("strips .git suffix from repo name", () => {
    const parsed = parseGitHubUrl("https://github.com/org/repo.git");
    expect(parsed?.repo).toBe("repo");
  });
});

describe("parseShieldsBadge", () => {
  it("parses workflow badge URLs", () => {
    const parsed = parseShieldsBadge(
      "https://img.shields.io/github/actions/workflow/status/org/repo/ci.yml",
    );
    expect(parsed).toMatchObject({
      org: "org",
      repo: "repo",
      type: "badge",
      workflow: "ci.yml",
    });
  });

  it("returns null for non-shields URLs", () => {
    expect(parseShieldsBadge("https://example.com")).toBeNull();
  });
});

describe("validateGitHubUrl", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns ok for existing repos", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "X-RateLimit-Remaining": "50" }),
    });

    const parsed = {
      org: "org",
      repo: "repo",
      type: "repo" as const,
      url: "https://github.com/org/repo",
    };
    const result = await validateGitHubUrl(makeLink(parsed.url), parsed, {});
    expect(result.status).toBe("ok");
  });

  it("returns broken for 404 repos", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "X-RateLimit-Remaining": "50" }),
    });

    const parsed = {
      org: "org",
      repo: "missing",
      type: "repo" as const,
      url: "https://github.com/org/missing",
    };
    const result = await validateGitHubUrl(makeLink(parsed.url), parsed, {});
    expect(result.status).toBe("broken");
    expect(result.httpStatus).toBe(404);
  });

  it("returns warning for 403 (private/rate-limited)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ "X-RateLimit-Remaining": "0" }),
    });

    const parsed = {
      org: "org",
      repo: "private",
      type: "repo" as const,
      url: "https://github.com/org/private",
    };
    const result = await validateGitHubUrl(makeLink(parsed.url), parsed, {});
    expect(result.status).toBe("warning");
  });

  it("validates raw URLs with HEAD request", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    const parsed = {
      org: "org",
      repo: "repo",
      type: "raw" as const,
      branch: "main",
      path: "logo.svg",
      url: "https://raw.githubusercontent.com/org/repo/main/logo.svg",
    };
    const result = await validateGitHubUrl(makeLink(parsed.url), parsed, {});
    expect(result.status).toBe("ok");
  });

  it("handles network errors gracefully", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const parsed = {
      org: "org",
      repo: "repo",
      type: "repo" as const,
      url: "https://github.com/org/repo",
    };
    const result = await validateGitHubUrl(makeLink(parsed.url), parsed, {});
    expect(result.status).toBe("error");
    expect(result.reason).toContain("Network failure");
  });
});
