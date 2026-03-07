import type { ExtractedLink, LinkValidationResult, ParsedGitHubUrl } from "./types.js";

const GITHUB_URL_RE =
  /github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(blob|tree)\/([^/]+)\/(.+))?(?:[?#].*)?$/;
const RAW_GH_RE = /raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;
const SHIELDS_WORKFLOW_RE =
  /img\.shields\.io\/github\/actions\/workflow\/status\/([^/]+)\/([^/]+)\/([^?]+)/;

export function parseGitHubUrl(url: string): ParsedGitHubUrl | null {
  // Try raw.githubusercontent.com first
  const rawMatch = RAW_GH_RE.exec(url);
  if (rawMatch) {
    return {
      org: rawMatch[1]!,
      repo: rawMatch[2]!,
      type: "raw",
      branch: rawMatch[3],
      path: rawMatch[4],
      url,
    };
  }

  const match = GITHUB_URL_RE.exec(url);
  if (!match) return null;

  const [, org, repo, pathType, branch, path] = match;
  if (!org || !repo) return null;

  let type: ParsedGitHubUrl["type"] = "repo";
  if (pathType === "blob") type = "file";
  else if (pathType === "tree") type = "tree";

  return { org, repo, type, branch, path, url };
}

export function parseShieldsBadge(url: string): ParsedGitHubUrl | null {
  const match = SHIELDS_WORKFLOW_RE.exec(url);
  if (!match) return null;

  return {
    org: match[1]!,
    repo: match[2]!,
    type: "badge",
    workflow: match[3],
    url,
  };
}

export interface GitHubValidatorOptions {
  token?: string;
  timeout?: number;
}

class GitHubRateLimiter {
  private remaining = 60;
  private resetAt = 0;

  async checkAndWait(): Promise<void> {
    if (this.remaining <= 1 && Date.now() < this.resetAt) {
      const waitMs = this.resetAt - Date.now() + 100;
      if (waitMs > 0 && waitMs < 60_000) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }

  update(headers: Headers): void {
    const remaining = headers.get("X-RateLimit-Remaining");
    const reset = headers.get("X-RateLimit-Reset");
    if (remaining !== null) this.remaining = parseInt(remaining, 10);
    if (reset !== null) this.resetAt = parseInt(reset, 10) * 1000;
  }
}

const rateLimiter = new GitHubRateLimiter();

export async function validateGitHubUrl(
  link: ExtractedLink,
  parsed: ParsedGitHubUrl,
  options: GitHubValidatorOptions = {},
): Promise<LinkValidationResult> {
  const start = Date.now();
  const { token, timeout = 10_000 } = options;

  // Resolve token from options or environment
  const authToken =
    token ??
    (typeof process !== "undefined"
      ? (process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN)
      : undefined);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "spike-land-ai-link-checker/1.0",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  await rateLimiter.checkAndWait();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    let apiUrl: string;

    switch (parsed.type) {
      case "repo":
        apiUrl = `https://api.github.com/repos/${parsed.org}/${parsed.repo}`;
        break;
      case "file":
      case "tree": {
        const ref = parsed.branch ? `?ref=${parsed.branch}` : "";
        apiUrl = `https://api.github.com/repos/${parsed.org}/${parsed.repo}/contents/${parsed.path ?? ""}${ref}`;
        break;
      }
      case "raw": {
        // For raw URLs, just do a HEAD request directly
        const response = await fetch(parsed.url, {
          method: "HEAD",
          signal: controller.signal,
          headers: { "User-Agent": "spike-land-ai-link-checker/1.0" },
        });
        clearTimeout(timer);
        return {
          link,
          status: response.ok ? "ok" : "broken",
          httpStatus: response.status,
          reason: response.ok ? "Raw file exists" : `HTTP ${response.status}`,
          durationMs: Date.now() - start,
        };
      }
      case "badge": {
        if (parsed.workflow) {
          apiUrl = `https://api.github.com/repos/${parsed.org}/${parsed.repo}/actions/workflows/${parsed.workflow}`;
        } else {
          apiUrl = `https://api.github.com/repos/${parsed.org}/${parsed.repo}`;
        }
        break;
      }
      default:
        apiUrl = `https://api.github.com/repos/${parsed.org}/${parsed.repo}`;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      signal: controller.signal,
      headers,
    });

    clearTimeout(timer);
    rateLimiter.update(response.headers);

    if (response.ok) {
      return {
        link,
        status: "ok",
        httpStatus: response.status,
        reason: "GitHub resource exists",
        durationMs: Date.now() - start,
      };
    }

    if (response.status === 404) {
      return {
        link,
        status: "broken",
        httpStatus: 404,
        reason: `GitHub ${parsed.type} not found: ${parsed.org}/${parsed.repo}${parsed.path ? `/${parsed.path}` : ""}`,
        durationMs: Date.now() - start,
      };
    }

    if (response.status === 403) {
      return {
        link,
        status: "warning",
        httpStatus: 403,
        reason: "GitHub resource is private or rate-limited",
        durationMs: Date.now() - start,
      };
    }

    return {
      link,
      status: "error",
      httpStatus: response.status,
      reason: `GitHub API returned ${response.status}`,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return {
      link,
      status: "error",
      reason: `GitHub validation error: ${message}`,
      durationMs: Date.now() - start,
    };
  }
}
