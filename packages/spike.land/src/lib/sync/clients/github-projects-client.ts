/**
 * GitHub Projects V2 Client
 *
 * GraphQL client for GitHub Projects V2 API.
 * Provides operations for managing project items.
 */

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

export interface ProjectItem {
  id: string;
  title: string;
  body: string;
  status: string;
  issueNumber?: number;
  issueUrl?: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  fieldValues: Record<string, string>;
}

export interface ProjectField {
  id: string;
  name: string;
  dataType: string;
  options?: Array<{ id: string; name: string; }>;
}

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
  projectId: string;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; type?: string; }>;
}

interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}

export class GitHubProjectsClient {
  private config: GitHubConfig;
  private rateLimitRemaining: number | null;
  private rateLimitResetAt: number | null;

  constructor(options?: {
    token?: string;
    owner?: string;
    repo?: string;
    projectId?: string;
  }) {
    this.config = {
      token: options?.token ?? process.env.GH_PAT_TOKEN ?? "",
      owner: options?.owner ?? process.env.GITHUB_OWNER ?? "spike-land-ai",
      repo: options?.repo ?? process.env.GITHUB_REPO ?? "spike.land",
      projectId: options?.projectId ?? process.env.GITHUB_PROJECT_ID ?? "",
    };
    this.rateLimitRemaining = null;
    this.rateLimitResetAt = null;
  }

  /**
   * Check if GitHub Projects is configured
   */
  isAvailable(): boolean {
    return !!(this.config.token && this.config.projectId);
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo | null {
    if (this.rateLimitRemaining === null) return null;
    return {
      remaining: this.rateLimitRemaining,
      resetAt: this.rateLimitResetAt
        ? new Date(this.rateLimitResetAt).toISOString()
        : "",
    };
  }

  /**
   * List project items with cursor-based pagination
   */
  async listItems(options?: {
    first?: number;
    after?: string;
  }): Promise<{
    data: {
      items: ProjectItem[];
      hasNextPage: boolean;
      endCursor: string | null;
    } | null;
    error: string | null;
  }> {
    const first = options?.first ?? 50;
    const afterClause = options?.after ? `, after: "${options.after}"` : "";

    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: ${first}${afterClause}) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                createdAt
                updatedAt
                content {
                  ... on Issue {
                    title
                    body
                    number
                    url
                    labels(first: 10) {
                      nodes { name }
                    }
                  }
                  ... on DraftIssue {
                    title
                    body
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldTextValue {
                      text
                      field { ... on ProjectV2Field { name } }
                    }
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      name
                      field { ... on ProjectV2SingleSelectField { name } }
                    }
                    ... on ProjectV2ItemFieldDateValue {
                      date
                      field { ... on ProjectV2Field { name } }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.graphql<{
      node: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null; };
          nodes: Array<{
            id: string;
            createdAt: string;
            updatedAt: string;
            content: {
              title?: string;
              body?: string;
              number?: number;
              url?: string;
              labels?: { nodes: Array<{ name: string; }>; };
            };
            fieldValues: {
              nodes: Array<{
                text?: string;
                name?: string;
                date?: string;
                field?: { name: string; };
              }>;
            };
          }>;
        };
      };
    }>(query, { projectId: this.config.projectId });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const itemsData = result.data.node.items;
    const items: ProjectItem[] = itemsData.nodes.map(node => {
      const fieldValues: Record<string, string> = {};
      for (const fv of node.fieldValues.nodes) {
        const fieldName = fv.field?.name;
        if (fieldName) {
          fieldValues[fieldName] = fv.text || fv.name || fv.date || "";
        }
      }

      return {
        id: node.id,
        title: node.content?.title ?? "",
        body: node.content?.body ?? "",
        status: fieldValues.Status ?? "",
        ...(node.content?.number !== undefined ? { issueNumber: node.content.number } : {}),
        ...(node.content?.url !== undefined ? { issueUrl: node.content.url } : {}),
        labels: node.content?.labels?.nodes.map(l => l.name) ?? [],
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
        fieldValues,
      };
    });

    return {
      data: {
        items,
        hasNextPage: itemsData.pageInfo.hasNextPage,
        endCursor: itemsData.pageInfo.endCursor,
      },
      error: null,
    };
  }

  /**
   * Get all items (auto-paginate)
   */
  async listAllItems(): Promise<
    { data: ProjectItem[] | null; error: string | null; }
  > {
    const allItems: ProjectItem[] = [];
    let cursor: string | undefined;

    for (let page = 0; page < 20; page++) {
      const result = await this.listItems({ first: 100, ...(cursor !== undefined ? { after: cursor } : {}) });
      if (result.error || !result.data) {
        return {
          data: allItems.length > 0 ? allItems : null,
          error: result.error,
        };
      }

      allItems.push(...result.data.items);

      if (!result.data.hasNextPage || !result.data.endCursor) {
        break;
      }
      cursor = result.data.endCursor;
    }

    return { data: allItems, error: null };
  }

  /**
   * Create a GitHub issue
   */
  async createIssue(options: {
    title: string;
    body: string;
    labels?: string[];
  }): Promise<
    {
      data: { number: number; id: string; url: string; } | null;
      error: string | null;
    }
  > {
    const query = `
      mutation($repositoryId: ID!, $title: String!, $body: String!, $labelIds: [ID!]) {
        createIssue(input: {
          repositoryId: $repositoryId
          title: $title
          body: $body
          labelIds: $labelIds
        }) {
          issue {
            number
            id
            url
          }
        }
      }
    `;

    // First get repository ID
    const repoResult = await this.getRepositoryId();
    if (repoResult.error || !repoResult.data) {
      return {
        data: null,
        error: repoResult.error ?? "Failed to get repository ID",
      };
    }

    // Resolve label IDs if needed
    let labelIds: string[] | undefined;
    if (options.labels?.length) {
      const labelsResult = await this.getLabelIds(options.labels);
      if (labelsResult.data) {
        labelIds = labelsResult.data;
      }
    }

    const result = await this.graphql<{
      createIssue: { issue: { number: number; id: string; url: string; }; };
    }>(query, {
      repositoryId: repoResult.data,
      title: options.title,
      body: options.body,
      labelIds,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return { data: result.data.createIssue.issue, error: null };
  }

  /**
   * Add an issue to the project
   */
  async addItemToProject(
    issueId: string,
  ): Promise<{ data: { itemId: string; } | null; error: string | null; }> {
    const query = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {
          projectId: $projectId
          contentId: $contentId
        }) {
          item { id }
        }
      }
    `;

    const result = await this.graphql<{
      addProjectV2ItemById: { item: { id: string; }; };
    }>(query, {
      projectId: this.config.projectId,
      contentId: issueId,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return {
      data: { itemId: result.data.addProjectV2ItemById.item.id },
      error: null,
    };
  }

  /**
   * Update a field value on a project item
   */
  async updateItemField(
    itemId: string,
    fieldId: string,
    value: { text?: string; singleSelectOptionId?: string; date?: string; },
  ): Promise<{ data: boolean; error: string | null; }> {
    const query = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: $value
        }) {
          projectV2Item { id }
        }
      }
    `;

    const result = await this.graphql<{
      updateProjectV2ItemFieldValue: { projectV2Item: { id: string; }; };
    }>(query, {
      projectId: this.config.projectId,
      itemId,
      fieldId,
      value,
    });

    if (result.error) {
      return { data: false, error: result.error };
    }

    return { data: true, error: null };
  }

  /**
   * Get project fields (to discover field IDs for updates)
   */
  async getProjectFields(): Promise<
    { data: ProjectField[] | null; error: string | null; }
  > {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 30) {
              nodes {
                ... on ProjectV2Field {
                  id
                  name
                  dataType
                }
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  dataType
                  options { id name }
                }
                ... on ProjectV2IterationField {
                  id
                  name
                  dataType
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.graphql<{
      node: {
        fields: {
          nodes: Array<{
            id: string;
            name: string;
            dataType: string;
            options?: Array<{ id: string; name: string; }>;
          }>;
        };
      };
    }>(query, { projectId: this.config.projectId });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return {
      data: result.data.node.fields.nodes.map(f => ({
        id: f.id,
        name: f.name,
        dataType: f.dataType,
        ...(f.options !== undefined ? { options: f.options } : {}),
      })),
      error: null,
    };
  }

  /**
   * Get PR status for an issue
   */
  async getPRStatus(issueNumber: number): Promise<{
    data: {
      prNumber: number | null;
      prState: string | null;
      ciStatus: string | null;
      reviewDecision: string | null;
      mergedAt: string | null;
    } | null;
    error: string | null;
  }> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            timelineItems(last: 10, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
              nodes {
                ... on ConnectedEvent {
                  subject {
                    ... on PullRequest {
                      number
                      state
                      mergedAt
                      reviewDecision
                      commits(last: 1) {
                        nodes {
                          commit {
                            statusCheckRollup {
                              state
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const result = await this.graphql<{
      repository: {
        issue: {
          timelineItems: {
            nodes: Array<{
              subject?: {
                number: number;
                state: string;
                mergedAt: string | null;
                reviewDecision: string | null;
                commits: {
                  nodes: Array<{
                    commit: {
                      statusCheckRollup: { state: string; } | null;
                    };
                  }>;
                };
              };
            }>;
          };
        };
      };
    }>(query, {
      owner: this.config.owner,
      repo: this.config.repo,
      number: issueNumber,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    // Find the most recent PR
    const timeline = result.data.repository.issue.timelineItems.nodes;
    const pr = timeline.find(n => n.subject)?.subject;

    if (!pr) {
      return {
        data: {
          prNumber: null,
          prState: null,
          ciStatus: null,
          reviewDecision: null,
          mergedAt: null,
        },
        error: null,
      };
    }

    const ciStatus = pr.commits.nodes[0]?.commit.statusCheckRollup?.state
      ?? null;

    return {
      data: {
        prNumber: pr.number,
        prState: pr.state,
        ciStatus,
        reviewDecision: pr.reviewDecision,
        mergedAt: pr.mergedAt,
      },
      error: null,
    };
  }

  // ========================================
  // Internal: GraphQL Client
  // ========================================

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<{ data: T | null; error: string | null; }> {
    // Rate limit check
    if (this.rateLimitRemaining !== null && this.rateLimitRemaining <= 0) {
      const now = Date.now();
      if (this.rateLimitResetAt && now < this.rateLimitResetAt) {
        const waitSeconds = Math.ceil((this.rateLimitResetAt - now) / 1000);
        return {
          data: null,
          error: `GitHub rate limit exceeded. Resets in ${waitSeconds}s`,
        };
      }
    }

    try {
      const response = await fetch(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });

      // Track rate limits
      const remaining = response.headers.get("x-ratelimit-remaining");
      const resetAt = response.headers.get("x-ratelimit-reset");
      if (remaining !== null) this.rateLimitRemaining = parseInt(remaining, 10);
      if (resetAt !== null) {
        this.rateLimitResetAt = parseInt(resetAt, 10) * 1000;
      }

      if (!response.ok) {
        return {
          data: null,
          error: `GitHub API error: ${response.status} ${response.statusText}`,
        };
      }

      const json = (await response.json()) as GraphQLResponse<T>;

      if (json.errors?.length) {
        return {
          data: null,
          error: json.errors.map(e => e.message).join("; "),
        };
      }

      return { data: json.data ?? null, error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getRepositoryId(): Promise<
    { data: string | null; error: string | null; }
  > {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) { id }
      }
    `;

    const result = await this.graphql<{ repository: { id: string; }; }>(query, {
      owner: this.config.owner,
      repo: this.config.repo,
    });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    return { data: result.data.repository.id, error: null };
  }

  private async getLabelIds(
    labelNames: string[],
  ): Promise<{ data: string[] | null; error: string | null; }> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          labels(first: 100) {
            nodes { id name }
          }
        }
      }
    `;

    const result = await this.graphql<{
      repository: { labels: { nodes: Array<{ id: string; name: string; }>; }; };
    }>(query, { owner: this.config.owner, repo: this.config.repo });

    if (result.error || !result.data) {
      return { data: null, error: result.error };
    }

    const allLabels = result.data.repository.labels.nodes;
    const matchedIds = labelNames
      .map(name => allLabels.find(l => l.name === name)?.id)
      .filter((id): id is string => !!id);

    return { data: matchedIds, error: null };
  }
}

/**
 * Check if GitHub Projects V2 is configured
 */
export function isGitHubProjectsAvailable(): boolean {
  return !!(process.env.GH_PAT_TOKEN && process.env.GITHUB_PROJECT_ID);
}
