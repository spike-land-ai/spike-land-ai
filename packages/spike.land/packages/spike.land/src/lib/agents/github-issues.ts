/**
 * GitHub Issues Client
 *
 * Utility for fetching GitHub issues via REST API.
 */

import { tryCatch } from "@/lib/try-catch";

const GITHUB_API_BASE = "https://api.github.com";

interface GitHubIssue {
  number: number;
  title: string;
  state: string;
  labels: string[];
  author: string;
  assignees: string[];
  createdAt: string;
  updatedAt: string;
  url: string;
  body: string | null;
}

interface GitHubApiIssue {
  number: number;
  title: string;
  state: string;
  labels: Array<{ name: string; }>;
  user: { login: string; };
  assignees: Array<{ login: string; }>;
  created_at: string;
  updated_at: string;
  html_url: string;
  body: string | null;
}

/**
 * Check if GitHub API is available (token is configured)
 */
export function isGitHubAvailable(): boolean {
  return !!process.env.GH_PAT_TOKEN;
}

/**
 * Get GitHub configuration from environment
 */
function getGitHubConfig() {
  const token = process.env.GH_PAT_TOKEN;
  const owner = process.env.GITHUB_OWNER || "spike-land-ai";
  const repo = process.env.GITHUB_REPO || "spike.land";
  const projectNumber = parseInt(process.env.GITHUB_PROJECT_NUMBER || "2");

  return { token, owner, repo, projectNumber };
}

/**
 * Make a request to the GitHub API
 */
async function githubRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<{ data: T | null; error: string | null; }> {
  const { token } = getGitHubConfig();

  if (!token) {
    return { data: null, error: "GH_PAT_TOKEN is not configured" };
  }

  const url = endpoint.startsWith("http")
    ? endpoint
    : `${GITHUB_API_BASE}${endpoint}`;

  const { data: response, error: fetchError } = await tryCatch(
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...options.headers,
      },
    }),
  );

  if (fetchError) {
    return { data: null, error: `Network error: ${fetchError.message}` };
  }

  if (!response) {
    return { data: null, error: "No response received" };
  }

  const { data: json, error: jsonError } = await tryCatch(response.json());

  if (jsonError) {
    return {
      data: null,
      error: `Failed to parse response: ${jsonError.message}`,
    };
  }

  if (!response.ok) {
    const message = (json as { message?: string; })?.message
      || `API error: ${response.status}`;
    return { data: null, error: message };
  }

  return { data: json as T, error: null };
}

/**
 * List open issues for the repository
 */
export async function listIssues(options?: {
  state?: "open" | "closed" | "all";
  labels?: string;
  limit?: number;
}): Promise<{ data: GitHubIssue[] | null; error: string | null; }> {
  const { owner, repo } = getGitHubConfig();
  const { state = "open", labels, limit = 20 } = options || {};

  const params = new URLSearchParams({
    state,
    per_page: String(limit),
    sort: "updated",
    direction: "desc",
  });

  if (labels) {
    params.set("labels", labels);
  }

  const { data, error } = await githubRequest<GitHubApiIssue[]>(
    `/repos/${owner}/${repo}/issues?${params}`,
  );

  if (error || !data) {
    return { data: null, error };
  }

  const issues: GitHubIssue[] = data.map(issue => ({
    number: issue.number,
    title: issue.title,
    state: issue.state,
    labels: issue.labels.map(l => l.name),
    author: issue.user.login,
    assignees: issue.assignees.map(a => a.login),
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    url: issue.html_url,
    body: issue.body,
  }));

  return { data: issues, error: null };
}

/**
 * Create a new issue in the repository
 */
export async function createIssue(options: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ data: GitHubIssue | null; error: string | null; }> {
  const { owner, repo } = getGitHubConfig();
  const { title, body, labels = [] } = options;

  const { data, error } = await githubRequest<GitHubApiIssue>(
    `/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title,
        body,
        labels,
      }),
    },
  );

  if (error || !data) {
    return { data: null, error };
  }

  const issue: GitHubIssue = {
    number: data.number,
    title: data.title,
    state: data.state,
    labels: data.labels.map(l => l.name),
    author: data.user.login,
    assignees: data.assignees.map(a => a.login),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    url: data.html_url,
    body: data.body,
  };

  return { data: issue, error: null };
}

/**
 * Get workflow runs (CI/CD status)
 */
export async function getWorkflowRuns(options?: { limit?: number; }): Promise<{
  data:
    | Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      branch: string;
      event: string;
      createdAt: string;
      url: string;
    }>
    | null;
  error: string | null;
}> {
  const { owner, repo } = getGitHubConfig();
  const { limit = 10 } = options || {};

  const { data, error } = await githubRequest<{
    workflow_runs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      head_branch: string;
      event: string;
      created_at: string;
      html_url: string;
    }>;
  }>(`/repos/${owner}/${repo}/actions/runs?per_page=${limit}`);

  if (error || !data) {
    return { data: null, error };
  }

  const runs = data.workflow_runs.map(run => ({
    id: run.id,
    name: run.name,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    event: run.event,
    createdAt: run.created_at,
    url: run.html_url,
  }));

  return { data: runs, error: null };
}
