import logger from "@/lib/logger";

const GITHUB_GRAPHQL = "https://api.github.com/graphql";
const OWNER = "spike-land-ai";
const REPO = "spike.land";
const PROJECT_NUMBER = 2;

interface RoadmapItem {
  id: string;
  title: string;
  status: string;
  type: "ISSUE" | "PULL_REQUEST" | "DRAFT_ISSUE";
  labels: string[];
  assignees: string[];
  url: string | null;
}

interface IssueSummary {
  open: number;
  closed: number;
  byLabel: Record<string, number>;
  recentlyUpdated: Array<{
    number: number;
    title: string;
    state: string;
    updatedAt: string;
  }>;
}

interface PRStatusSummary {
  open: number;
  merged: number;
  pending: Array<{
    number: number;
    title: string;
    author: string;
    checksStatus: string;
    reviewDecision: string;
    isDraft: boolean;
    updatedAt: string;
  }>;
}

function getAuth(): string | null {
  return process.env.GH_PAT_TOKEN ?? null;
}

async function graphqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  timeoutMs = 15_000,
): Promise<T | null> {
  const token = getAuth();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(GITHUB_GRAPHQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    if (!res.ok) {
      logger.warn(`GitHub GraphQL error: ${res.status} ${res.statusText}`);
      return null;
    }

    const body = (await res.json()) as {
      data?: T;
      errors?: Array<{ message: string }>;
    };
    if (body.errors?.length) {
      logger.warn("GitHub GraphQL returned errors", {
        errors: body.errors.map((e) => e.message),
      });
      return null;
    }
    return body.data ?? null;
  } catch (err) {
    logger.warn("GitHub GraphQL fetch failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface ProjectItemNode {
  id: string;
  fieldValueByName: { name: string } | null;
  content: {
    __typename: string;
    title: string;
    url?: string;
    labels?: { nodes: Array<{ name: string }> };
    assignees?: { nodes: Array<{ login: string }> };
  } | null;
}

export async function getRoadmapItems(): Promise<RoadmapItem[] | null> {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 50) {
            nodes {
              id
              fieldValueByName(name: "Status") {
                ... on ProjectV2ItemFieldSingleSelectValue { name }
              }
              content {
                __typename
                ... on Issue {
                  title
                  url
                  labels(first: 10) { nodes { name } }
                  assignees(first: 5) { nodes { login } }
                }
                ... on PullRequest {
                  title
                  url
                  labels(first: 10) { nodes { name } }
                  assignees(first: 5) { nodes { login } }
                }
                ... on DraftIssue {
                  title
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphqlFetch<{
    user: {
      projectV2: {
        items: { nodes: ProjectItemNode[] };
      };
    };
  }>(query, { owner: OWNER, number: PROJECT_NUMBER });

  if (!data) return null;

  return data.user.projectV2.items.nodes.map((node) => ({
    id: node.id,
    title: node.content?.title ?? "Untitled",
    status: node.fieldValueByName?.name ?? "No Status",
    type: (node.content?.__typename === "PullRequest"
      ? "PULL_REQUEST"
      : node.content?.__typename === "DraftIssue"
        ? "DRAFT_ISSUE"
        : "ISSUE") as RoadmapItem["type"],
    labels: node.content?.labels?.nodes.map((l) => l.name) ?? [],
    assignees: node.content?.assignees?.nodes.map((a) => a.login) ?? [],
    url: node.content?.url ?? null,
  }));
}

export async function getIssuesSummary(): Promise<IssueSummary | null> {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        open: issues(states: OPEN) { totalCount }
        closed: issues(states: CLOSED) { totalCount }
        recent: issues(first: 10, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            number
            title
            state
            updatedAt
            labels(first: 10) { nodes { name } }
          }
        }
      }
    }
  `;

  const data = await graphqlFetch<{
    repository: {
      open: { totalCount: number };
      closed: { totalCount: number };
      recent: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          updatedAt: string;
          labels: { nodes: Array<{ name: string }> };
        }>;
      };
    };
  }>(query, { owner: OWNER, repo: REPO });

  if (!data) return null;

  const byLabel: Record<string, number> = {};
  for (const issue of data.repository.recent.nodes) {
    for (const label of issue.labels.nodes) {
      byLabel[label.name] = (byLabel[label.name] ?? 0) + 1;
    }
  }

  return {
    open: data.repository.open.totalCount,
    closed: data.repository.closed.totalCount,
    byLabel,
    recentlyUpdated: data.repository.recent.nodes.map((n) => ({
      number: n.number,
      title: n.title,
      state: n.state,
      updatedAt: n.updatedAt,
    })),
  };
}

export async function getPRStatus(): Promise<PRStatusSummary | null> {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        open: pullRequests(states: OPEN) { totalCount }
        merged: pullRequests(states: MERGED) { totalCount }
        pending: pullRequests(first: 10, states: OPEN, orderBy: { field: UPDATED_AT, direction: DESC }) {
          nodes {
            number
            title
            author { login }
            isDraft
            reviewDecision
            updatedAt
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup { state }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await graphqlFetch<{
    repository: {
      open: { totalCount: number };
      merged: { totalCount: number };
      pending: {
        nodes: Array<{
          number: number;
          title: string;
          author: { login: string };
          isDraft: boolean;
          reviewDecision: string | null;
          updatedAt: string;
          commits: {
            nodes: Array<{
              commit: {
                statusCheckRollup: { state: string } | null;
              };
            }>;
          };
        }>;
      };
    };
  }>(query, { owner: OWNER, repo: REPO });

  if (!data) return null;

  return {
    open: data.repository.open.totalCount,
    merged: data.repository.merged.totalCount,
    pending: data.repository.pending.nodes.map((pr) => ({
      number: pr.number,
      title: pr.title,
      author: pr.author.login,
      checksStatus: pr.commits.nodes[0]?.commit.statusCheckRollup?.state ?? "UNKNOWN",
      reviewDecision: pr.reviewDecision ?? "NONE",
      isDraft: pr.isDraft,
      updatedAt: pr.updatedAt,
    })),
  };
}

export type { IssueSummary, PRStatusSummary, RoadmapItem };
