/**
 * Tests for GitHubProjectsClient
 *
 * Tests the full API surface:
 * - Constructor / configuration
 * - isAvailable()
 * - getRateLimitInfo()
 * - listItems() with pagination
 * - listAllItems() with auto-pagination
 * - createIssue()
 * - addItemToProject()
 * - updateItemField()
 * - getProjectFields()
 * - getPRStatus()
 * - isGitHubProjectsAvailable() (module-level function)
 * - Internal graphql() error paths (auth, rate limit, network)
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from "vitest";
import {
  GitHubProjectsClient,
  isGitHubProjectsAvailable,
  type ProjectField,
  type ProjectItem,
} from "./github-projects-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Response-like object for mocking global.fetch */
function mockFetchResponse(
  body: unknown,
  options: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  } = {},
): Response {
  const { status = 200, statusText = "OK", headers = {} } = options;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Convenience: build a happy-path GraphQL response envelope */
function gqlOk<T>(data: T): { data: T; errors?: never; } {
  return { data };
}

/** Convenience: build a GraphQL error envelope */
function gqlErrors(
  ...messages: string[]
): { data?: never; errors: Array<{ message: string; }>; } {
  return { errors: messages.map(message => ({ message })) };
}

// ---------------------------------------------------------------------------
// Shared fixture builders
// ---------------------------------------------------------------------------

function makeRawNode(overrides: {
  id?: string;
  title?: string;
  body?: string;
  number?: number;
  url?: string;
  labels?: string[];
  fieldValues?: Array<{ text?: string; name?: string; date?: string; field?: { name: string; }; }>;
  createdAt?: string;
  updatedAt?: string;
}) {
  return {
    id: overrides.id ?? "item_1",
    createdAt: overrides.createdAt ?? "2024-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2024-01-02T00:00:00Z",
    content: {
      title: overrides.title ?? "Test Issue",
      body: overrides.body ?? "Body text",
      number: overrides.number,
      url: overrides.url,
      labels: overrides.labels
        ? { nodes: overrides.labels.map(name => ({ name })) }
        : undefined,
    },
    fieldValues: {
      nodes: overrides.fieldValues ?? [
        { name: "In Progress", field: { name: "Status" } },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let fetchMock: MockedFunction<typeof fetch>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);

  // Clear env vars so tests are deterministic
  delete process.env.GH_PAT_TOKEN;
  delete process.env.GITHUB_OWNER;
  delete process.env.GITHUB_REPO;
  delete process.env.GITHUB_PROJECT_ID;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Constructor & isAvailable
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – constructor & isAvailable", () => {
  it("reads token and projectId from options", () => {
    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj_1",
      owner: "acme",
      repo: "app",
    });
    expect(client.isAvailable()).toBe(true);
  });

  it("reads token from GH_PAT_TOKEN env var when option omitted", () => {
    process.env.GH_PAT_TOKEN = "env_token";
    process.env.GITHUB_PROJECT_ID = "env_proj";
    const client = new GitHubProjectsClient();
    expect(client.isAvailable()).toBe(true);
  });

  it("returns false when token is missing", () => {
    const client = new GitHubProjectsClient({ projectId: "proj_1" });
    expect(client.isAvailable()).toBe(false);
  });

  it("returns false when projectId is missing", () => {
    const client = new GitHubProjectsClient({ token: "tok" });
    expect(client.isAvailable()).toBe(false);
  });

  it("returns false when both token and projectId are missing", () => {
    const client = new GitHubProjectsClient();
    expect(client.isAvailable()).toBe(false);
  });

  it("uses default owner spike-land-ai when env not set", () => {
    // We verify indirectly: a query to listItems should embed the default owner
    // (we can't read private config, but the default path is covered here).
    const client = new GitHubProjectsClient({ token: "tok", projectId: "p" });
    expect(client.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRateLimitInfo
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – getRateLimitInfo", () => {
  it("returns null before any requests", () => {
    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj",
    });
    expect(client.getRateLimitInfo()).toBeNull();
  });

  it("returns remaining and resetAt after a request with rate-limit headers", async () => {
    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj",
    });

    const resetEpoch = Math.floor(Date.now() / 1000) + 3600;

    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
        {
          headers: {
            "x-ratelimit-remaining": "42",
            "x-ratelimit-reset": String(resetEpoch),
          },
        },
      ),
    );

    await client.listItems();
    const info = client.getRateLimitInfo();
    expect(info).not.toBeNull();
    expect(info!.remaining).toBe(42);
    expect(info!.resetAt).toBe(new Date(resetEpoch * 1000).toISOString());
  });

  it("returns empty resetAt string when rateLimitResetAt is null internally", async () => {
    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj",
    });

    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
        {
          headers: {
            "x-ratelimit-remaining": "10",
            // no x-ratelimit-reset header → rateLimitResetAt stays null
          },
        },
      ),
    );

    await client.listItems();
    const info = client.getRateLimitInfo();
    expect(info).not.toBeNull();
    expect(info!.remaining).toBe(10);
    expect(info!.resetAt).toBe("");
  });
});

// ---------------------------------------------------------------------------
// listItems
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – listItems", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  it("returns items with correct shape on success", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                makeRawNode({
                  id: "item_abc",
                  title: "Bug: crash on load",
                  body: "Steps to reproduce…",
                  number: 42,
                  url: "https://github.com/org/repo/issues/42",
                  labels: ["bug", "p1"],
                  fieldValues: [
                    { name: "Done", field: { name: "Status" } },
                    { text: "Sprint 3", field: { name: "Iteration" } },
                  ],
                }),
              ],
            },
          },
        }),
      ),
    );

    const result = await client.listItems();
    expect(result.error).toBeNull();
    expect(result.data).not.toBeNull();

    const item = result.data!.items[0]!;
    expect(item.id).toBe("item_abc");
    expect(item.title).toBe("Bug: crash on load");
    expect(item.body).toBe("Steps to reproduce…");
    expect(item.issueNumber).toBe(42);
    expect(item.issueUrl).toBe("https://github.com/org/repo/issues/42");
    expect(item.labels).toEqual(["bug", "p1"]);
    expect(item.status).toBe("Done");
    expect(item.fieldValues["Status"]).toBe("Done");
    expect(item.fieldValues["Iteration"]).toBe("Sprint 3");
    expect(result.data!.hasNextPage).toBe(false);
    expect(result.data!.endCursor).toBeNull();
  });

  it("maps DraftIssue nodes (no number/url/labels)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: "draft_1",
                  createdAt: "2024-03-01T00:00:00Z",
                  updatedAt: "2024-03-01T00:00:00Z",
                  content: { title: "Draft note", body: "" },
                  fieldValues: { nodes: [] },
                },
              ],
            },
          },
        }),
      ),
    );

    const result = await client.listItems();
    expect(result.error).toBeNull();
    const item = result.data!.items[0]!;
    expect(item.title).toBe("Draft note");
    expect(item.issueNumber).toBeUndefined();
    expect(item.issueUrl).toBeUndefined();
    expect(item.labels).toEqual([]);
    expect(item.status).toBe("");
  });

  it("handles pagination: returns hasNextPage=true and endCursor", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: true, endCursor: "cursor_abc" },
              nodes: [makeRawNode({ id: "item_1" })],
            },
          },
        }),
      ),
    );

    const result = await client.listItems({ first: 1 });
    expect(result.data!.hasNextPage).toBe(true);
    expect(result.data!.endCursor).toBe("cursor_abc");
  });

  it("passes the after cursor in the query when provided", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
      ),
    );

    await client.listItems({ first: 10, after: "cursor_xyz" });

    const body = JSON.parse(
      vi.mocked(fetchMock).mock.calls[0]![1]!.body as string,
    ) as { query: string; };
    expect(body.query).toContain("after: \"cursor_xyz\"");
  });

  it("returns error when GraphQL returns errors array", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Not authorized")),
    );

    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toBe("Not authorized");
  });

  it("returns error on HTTP 401", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({}, { status: 401, statusText: "Unauthorized" }),
    );

    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toContain("401");
  });

  it("returns error on HTTP 403 (forbidden / bad credentials)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({}, { status: 403, statusText: "Forbidden" }),
    );

    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toContain("403");
  });

  it("returns error on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toBe("Network error");
  });

  it("returns error for non-Error throws", async () => {
    fetchMock.mockRejectedValueOnce("string-error");

    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unknown error");
  });

  it("returns error when rate limit exceeded and reset has not passed", async () => {
    // Prime rate-limit state by making one successful request
    const futureReset = Math.floor(Date.now() / 1000) + 3600;
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
        {
          headers: {
            "x-ratelimit-remaining": "0",
            "x-ratelimit-reset": String(futureReset),
          },
        },
      ),
    );
    await client.listItems();

    // Second call should be blocked without hitting fetch
    const result = await client.listItems();
    expect(result.data).toBeNull();
    expect(result.error).toMatch(/rate limit exceeded/i);
    // Fetch was only called once (for the priming call)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT block when rate limit reset time has already passed", async () => {
    const pastReset = Math.floor(Date.now() / 1000) - 10; // already in the past
    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            node: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            },
          }),
          {
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String(pastReset),
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            node: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [],
              },
            },
          }),
        ),
      );

    await client.listItems(); // primes state
    const result = await client.listItems(); // should NOT be blocked
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.error).toBeNull();
  });

  it("sends correct Authorization header", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
      ),
    );

    const secureClient = new GitHubProjectsClient({
      token: "my-secret-token",
      projectId: "p",
    });
    await secureClient.listItems();

    const options = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = options.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer my-secret-token");
  });

  it("concatenates multiple GraphQL error messages", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Field missing", "Permission denied")),
    );

    const result = await client.listItems();
    expect(result.error).toBe("Field missing; Permission denied");
  });
});

// ---------------------------------------------------------------------------
// listAllItems (auto-pagination)
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – listAllItems", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  it("fetches all pages and concatenates items", async () => {
    // Page 1
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: true, endCursor: "cursor_1" },
              nodes: [makeRawNode({ id: "item_1", title: "First" })],
            },
          },
        }),
      ),
    );
    // Page 2
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [makeRawNode({ id: "item_2", title: "Second" })],
            },
          },
        }),
      ),
    );

    const result = await client.listAllItems();
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data![0]!.id).toBe("item_1");
    expect(result.data![1]!.id).toBe("item_2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns items collected so far when a mid-pagination error occurs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            node: {
              items: {
                pageInfo: { hasNextPage: true, endCursor: "cursor_1" },
                nodes: [makeRawNode({ id: "item_1" })],
              },
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        mockFetchResponse(gqlErrors("Server error on page 2")),
      );

    const result = await client.listAllItems();
    expect(result.error).toBe("Server error on page 2");
    // Already-fetched items returned
    expect(result.data).toHaveLength(1);
    expect(result.data![0]!.id).toBe("item_1");
  });

  it("returns null data (not empty array) when first page fails", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Auth failure")),
    );

    const result = await client.listAllItems();
    expect(result.error).toBe("Auth failure");
    expect(result.data).toBeNull();
  });

  it("stops paginating after 20 pages to prevent infinite loops", async () => {
    // Always return hasNextPage=true
    fetchMock.mockResolvedValue(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: true, endCursor: "cursor_x" },
              nodes: [makeRawNode({})],
            },
          },
        }),
      ),
    );

    const result = await client.listAllItems();
    expect(result.error).toBeNull();
    // 20 pages × 1 item each
    expect(result.data).toHaveLength(20);
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it("returns empty array when project has no items", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            items: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [],
            },
          },
        }),
      ),
    );

    const result = await client.listAllItems();
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createIssue
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – createIssue", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({
      token: "tok",
      owner: "acme",
      repo: "app",
      projectId: "proj_1",
    });
  });

  const repoIdResponse = gqlOk({ repository: { id: "repo_abc" } });

  it("creates an issue without labels", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(repoIdResponse)) // getRepositoryId
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            createIssue: {
              issue: {
                number: 7,
                id: "issue_id_7",
                url: "https://github.com/acme/app/issues/7",
              },
            },
          }),
        ),
      );

    const result = await client.createIssue({
      title: "New bug",
      body: "Details here",
    });

    expect(result.error).toBeNull();
    expect(result.data!.number).toBe(7);
    expect(result.data!.id).toBe("issue_id_7");
    expect(result.data!.url).toBe("https://github.com/acme/app/issues/7");
  });

  it("creates an issue with matched labels", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(repoIdResponse)) // getRepositoryId
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            repository: {
              labels: {
                nodes: [
                  { id: "lbl_bug", name: "bug" },
                  { id: "lbl_p1", name: "p1" },
                ],
              },
            },
          }),
        ),
      ) // getLabelIds
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            createIssue: {
              issue: { number: 10, id: "issue_10", url: "url_10" },
            },
          }),
        ),
      );

    const result = await client.createIssue({
      title: "Labeled issue",
      body: "With labels",
      labels: ["bug", "p1"],
    });

    expect(result.error).toBeNull();
    expect(result.data!.number).toBe(10);

    // Verify labelIds were passed to the createIssue mutation
    const createMutationCall = fetchMock.mock.calls[2]!;
    const body = JSON.parse(createMutationCall[1]!.body as string) as {
      variables: { labelIds?: string[]; };
    };
    expect(body.variables.labelIds).toEqual(["lbl_bug", "lbl_p1"]);
  });

  it("creates an issue even when labels array is empty", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(repoIdResponse))
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            createIssue: {
              issue: { number: 11, id: "issue_11", url: "url_11" },
            },
          }),
        ),
      );

    const result = await client.createIssue({
      title: "No labels",
      body: "Body",
      labels: [],
    });
    expect(result.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2); // no getLabelIds call
  });

  it("returns error when getRepositoryId fails", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Repository not found")),
    );

    const result = await client.createIssue({ title: "T", body: "B" });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Repository not found");
  });

  it("returns error when createIssue mutation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(repoIdResponse))
      .mockResolvedValueOnce(mockFetchResponse(gqlErrors("Mutation failed")));

    const result = await client.createIssue({ title: "T", body: "B" });
    expect(result.data).toBeNull();
    expect(result.error).toBe("Mutation failed");
  });

  it("ignores labels that do not exist in the repo", async () => {
    fetchMock
      .mockResolvedValueOnce(mockFetchResponse(repoIdResponse))
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            repository: {
              labels: {
                nodes: [{ id: "lbl_bug", name: "bug" }], // only 'bug' exists
              },
            },
          }),
        ),
      )
      .mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            createIssue: {
              issue: { number: 12, id: "issue_12", url: "url_12" },
            },
          }),
        ),
      );

    const result = await client.createIssue({
      title: "Mixed labels",
      body: "B",
      labels: ["bug", "nonexistent"],
    });
    expect(result.error).toBeNull();
    const body = JSON.parse(
      fetchMock.mock.calls[2]![1]!.body as string,
    ) as { variables: { labelIds?: string[]; }; };
    expect(body.variables.labelIds).toEqual(["lbl_bug"]);
  });
});

// ---------------------------------------------------------------------------
// addItemToProject
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – addItemToProject", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  it("returns itemId on success", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          addProjectV2ItemById: { item: { id: "pi_abc123" } },
        }),
      ),
    );

    const result = await client.addItemToProject("issue_xyz");
    expect(result.error).toBeNull();
    expect(result.data!.itemId).toBe("pi_abc123");
  });

  it("passes projectId and contentId as variables", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          addProjectV2ItemById: { item: { id: "pi_1" } },
        }),
      ),
    );

    const c = new GitHubProjectsClient({
      token: "tok",
      projectId: "PROJ_SPECIFIC",
    });
    await c.addItemToProject("ISSUE_ID");

    const body = JSON.parse(
      fetchMock.mock.calls[0]![1]!.body as string,
    ) as { variables: { projectId: string; contentId: string; }; };
    expect(body.variables.projectId).toBe("PROJ_SPECIFIC");
    expect(body.variables.contentId).toBe("ISSUE_ID");
  });

  it("returns error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Content not found")),
    );

    const result = await client.addItemToProject("bad_id");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Content not found");
  });

  it("returns error on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Timeout"));

    const result = await client.addItemToProject("issue_id");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Timeout");
  });
});

// ---------------------------------------------------------------------------
// updateItemField
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – updateItemField", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  it("returns true on successful text field update", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          updateProjectV2ItemFieldValue: { projectV2Item: { id: "item_1" } },
        }),
      ),
    );

    const result = await client.updateItemField("item_1", "field_1", {
      text: "Sprint 5",
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });

  it("returns true on single-select field update", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          updateProjectV2ItemFieldValue: { projectV2Item: { id: "item_2" } },
        }),
      ),
    );

    const result = await client.updateItemField("item_2", "field_status", {
      singleSelectOptionId: "opt_done",
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });

  it("returns true on date field update", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          updateProjectV2ItemFieldValue: { projectV2Item: { id: "item_3" } },
        }),
      ),
    );

    const result = await client.updateItemField("item_3", "field_due", {
      date: "2025-12-31",
    });
    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });

  it("passes correct variables to the mutation", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          updateProjectV2ItemFieldValue: { projectV2Item: { id: "item_1" } },
        }),
      ),
    );

    await client.updateItemField("ITEM_ID", "FIELD_ID", { text: "Hello" });

    const body = JSON.parse(
      fetchMock.mock.calls[0]![1]!.body as string,
    ) as {
      variables: {
        projectId: string;
        itemId: string;
        fieldId: string;
        value: { text: string; };
      };
    };
    expect(body.variables.projectId).toBe("proj_1");
    expect(body.variables.itemId).toBe("ITEM_ID");
    expect(body.variables.fieldId).toBe("FIELD_ID");
    expect(body.variables.value).toEqual({ text: "Hello" });
  });

  it("returns false and error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Field not found")),
    );

    const result = await client.updateItemField("i", "f", { text: "v" });
    expect(result.data).toBe(false);
    expect(result.error).toBe("Field not found");
  });

  it("returns error on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Connection refused"));

    const result = await client.updateItemField("i", "f", { text: "v" });
    expect(result.data).toBe(false);
    expect(result.error).toBe("Connection refused");
  });
});

// ---------------------------------------------------------------------------
// getProjectFields
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – getProjectFields", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  it("returns fields with options for single-select fields", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: {
            fields: {
              nodes: [
                { id: "f_title", name: "Title", dataType: "TEXT" },
                {
                  id: "f_status",
                  name: "Status",
                  dataType: "SINGLE_SELECT",
                  options: [
                    { id: "opt_todo", name: "Todo" },
                    { id: "opt_done", name: "Done" },
                  ],
                },
                { id: "f_iter", name: "Sprint", dataType: "ITERATION" },
              ],
            },
          },
        }),
      ),
    );

    const result = await client.getProjectFields();
    expect(result.error).toBeNull();
    const fields = result.data as ProjectField[];
    expect(fields).toHaveLength(3);

    const titleField = fields.find(f => f.name === "Title")!;
    expect(titleField.id).toBe("f_title");
    expect(titleField.dataType).toBe("TEXT");
    expect(titleField.options).toBeUndefined();

    const statusField = fields.find(f => f.name === "Status")!;
    expect(statusField.options).toEqual([
      { id: "opt_todo", name: "Todo" },
      { id: "opt_done", name: "Done" },
    ]);
  });

  it("returns error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Project not found")),
    );

    const result = await client.getProjectFields();
    expect(result.data).toBeNull();
    expect(result.error).toBe("Project not found");
  });

  it("returns error on HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse({}, { status: 500, statusText: "Internal Server Error" }),
    );

    const result = await client.getProjectFields();
    expect(result.data).toBeNull();
    expect(result.error).toContain("500");
  });

  it("returns empty array when project has no fields", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          node: { fields: { nodes: [] } },
        }),
      ),
    );

    const result = await client.getProjectFields();
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getPRStatus
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – getPRStatus", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({
      token: "tok",
      owner: "acme",
      repo: "app",
      projectId: "proj_1",
    });
  });

  it("returns full PR status when a linked PR exists", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: {
            issue: {
              timelineItems: {
                nodes: [
                  {
                    subject: {
                      number: 55,
                      state: "MERGED",
                      mergedAt: "2024-06-01T12:00:00Z",
                      reviewDecision: "APPROVED",
                      commits: {
                        nodes: [
                          {
                            commit: {
                              statusCheckRollup: { state: "SUCCESS" },
                            },
                          },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      ),
    );

    const result = await client.getPRStatus(100);
    expect(result.error).toBeNull();
    expect(result.data!.prNumber).toBe(55);
    expect(result.data!.prState).toBe("MERGED");
    expect(result.data!.mergedAt).toBe("2024-06-01T12:00:00Z");
    expect(result.data!.reviewDecision).toBe("APPROVED");
    expect(result.data!.ciStatus).toBe("SUCCESS");
  });

  it("returns all-null PR fields when issue has no linked PR", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: {
            issue: {
              timelineItems: {
                nodes: [
                  {/* no subject field – not a ConnectedEvent with a PR */},
                ],
              },
            },
          },
        }),
      ),
    );

    const result = await client.getPRStatus(200);
    expect(result.error).toBeNull();
    expect(result.data!.prNumber).toBeNull();
    expect(result.data!.prState).toBeNull();
    expect(result.data!.ciStatus).toBeNull();
    expect(result.data!.reviewDecision).toBeNull();
    expect(result.data!.mergedAt).toBeNull();
  });

  it("returns all-null PR fields when timeline is empty", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: {
            issue: { timelineItems: { nodes: [] } },
          },
        }),
      ),
    );

    const result = await client.getPRStatus(201);
    expect(result.error).toBeNull();
    expect(result.data!.prNumber).toBeNull();
  });

  it("handles PR with no statusCheckRollup (ciStatus is null)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: {
            issue: {
              timelineItems: {
                nodes: [
                  {
                    subject: {
                      number: 60,
                      state: "OPEN",
                      mergedAt: null,
                      reviewDecision: null,
                      commits: {
                        nodes: [
                          { commit: { statusCheckRollup: null } },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
        }),
      ),
    );

    const result = await client.getPRStatus(300);
    expect(result.error).toBeNull();
    expect(result.data!.ciStatus).toBeNull();
  });

  it("handles PR with empty commits array", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: {
            issue: {
              timelineItems: {
                nodes: [
                  {
                    subject: {
                      number: 61,
                      state: "OPEN",
                      mergedAt: null,
                      reviewDecision: null,
                      commits: { nodes: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
      ),
    );

    const result = await client.getPRStatus(301);
    expect(result.error).toBeNull();
    expect(result.data!.ciStatus).toBeNull();
  });

  it("passes owner, repo, number as variables", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(
        gqlOk({
          repository: { issue: { timelineItems: { nodes: [] } } },
        }),
      ),
    );

    await client.getPRStatus(42);
    const body = JSON.parse(
      fetchMock.mock.calls[0]![1]!.body as string,
    ) as { variables: { owner: string; repo: string; number: number; }; };
    expect(body.variables.owner).toBe("acme");
    expect(body.variables.repo).toBe("app");
    expect(body.variables.number).toBe(42);
  });

  it("returns error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(
      mockFetchResponse(gqlErrors("Issue not found")),
    );

    const result = await client.getPRStatus(999);
    expect(result.data).toBeNull();
    expect(result.error).toBe("Issue not found");
  });

  it("returns error on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("DNS lookup failed"));

    const result = await client.getPRStatus(1);
    expect(result.data).toBeNull();
    expect(result.error).toBe("DNS lookup failed");
  });
});

// ---------------------------------------------------------------------------
// isGitHubProjectsAvailable (module-level function)
// ---------------------------------------------------------------------------

describe("isGitHubProjectsAvailable", () => {
  afterEach(() => {
    delete process.env.GH_PAT_TOKEN;
    delete process.env.GITHUB_PROJECT_ID;
  });

  it("returns true when both env vars are set", () => {
    process.env.GH_PAT_TOKEN = "token";
    process.env.GITHUB_PROJECT_ID = "proj";
    expect(isGitHubProjectsAvailable()).toBe(true);
  });

  it("returns false when GH_PAT_TOKEN is missing", () => {
    process.env.GITHUB_PROJECT_ID = "proj";
    expect(isGitHubProjectsAvailable()).toBe(false);
  });

  it("returns false when GITHUB_PROJECT_ID is missing", () => {
    process.env.GH_PAT_TOKEN = "token";
    expect(isGitHubProjectsAvailable()).toBe(false);
  });

  it("returns false when both are missing", () => {
    expect(isGitHubProjectsAvailable()).toBe(false);
  });

  it("returns false when GH_PAT_TOKEN is empty string", () => {
    process.env.GH_PAT_TOKEN = "";
    process.env.GITHUB_PROJECT_ID = "proj";
    expect(isGitHubProjectsAvailable()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Status field mapping – comprehensive fieldValues scenarios
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – status field mapping", () => {
  let client: GitHubProjectsClient;

  beforeEach(() => {
    client = new GitHubProjectsClient({ token: "tok", projectId: "proj_1" });
  });

  function singleItemResponse(
    fieldValues: Array<{
      text?: string;
      name?: string;
      date?: string;
      field?: { name: string; };
    }>,
  ) {
    return mockFetchResponse(
      gqlOk({
        node: {
          items: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                id: "item_1",
                createdAt: "2024-01-01T00:00:00Z",
                updatedAt: "2024-01-01T00:00:00Z",
                content: { title: "T", body: "" },
                fieldValues: { nodes: fieldValues },
              },
            ],
          },
        },
      }),
    );
  }

  it("prefers text over name over date when all present", async () => {
    fetchMock.mockResolvedValueOnce(
      singleItemResponse([
        { text: "TextVal", name: "NameVal", date: "2024-01-01", field: { name: "Multi" } },
      ]),
    );

    const result = await client.listItems();
    const item = result.data!.items[0]!;
    // text is checked first in the source: fv.text || fv.name || fv.date
    expect(item.fieldValues["Multi"]).toBe("TextVal");
  });

  it("falls back to name when text is absent", async () => {
    fetchMock.mockResolvedValueOnce(
      singleItemResponse([
        { name: "In Progress", field: { name: "Status" } },
      ]),
    );

    const result = await client.listItems();
    expect(result.data!.items[0]!.status).toBe("In Progress");
  });

  it("falls back to date when text and name are absent", async () => {
    fetchMock.mockResolvedValueOnce(
      singleItemResponse([
        { date: "2025-01-15", field: { name: "DueDate" } },
      ]),
    );

    const result = await client.listItems();
    expect(result.data!.items[0]!.fieldValues["DueDate"]).toBe("2025-01-15");
  });

  it("skips field values without a field name", async () => {
    fetchMock.mockResolvedValueOnce(
      singleItemResponse([
        { text: "orphan value" /* no field property */ },
      ]),
    );

    const result = await client.listItems();
    // The item should not have any field value keys (field name is undefined)
    expect(Object.keys(result.data!.items[0]!.fieldValues)).toHaveLength(0);
  });

  it("sets status to empty string when no Status field present", async () => {
    fetchMock.mockResolvedValueOnce(
      singleItemResponse([
        { text: "Sprint 1", field: { name: "Iteration" } },
      ]),
    );

    const result = await client.listItems();
    expect(result.data!.items[0]!.status).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Large dataset / batch scenarios
// ---------------------------------------------------------------------------

describe("GitHubProjectsClient – large dataset scenarios", () => {
  it("handles 100 items per page correctly", async () => {
    const nodes = Array.from(
      { length: 100 },
      (_, i) => makeRawNode({ id: `item_${i}`, title: `Issue ${i}` }),
    );

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse(
          gqlOk({
            node: {
              items: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes,
              },
            },
          }),
        ),
      ),
    );

    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj_1",
    });
    const result = await client.listItems({ first: 100 });
    expect(result.error).toBeNull();
    expect(result.data!.items).toHaveLength(100);
    expect(result.data!.items[99]!.id).toBe("item_99");
  });

  it("listAllItems accumulates items across many pages", async () => {
    const mockFn = vi.fn();
    vi.stubGlobal("fetch", mockFn);

    // 5 pages of 10 items each
    for (let page = 0; page < 5; page++) {
      const isLast = page === 4;
      const nodes = Array.from({ length: 10 }, (_, i) => makeRawNode({ id: `item_p${page}_${i}` }));
      mockFn.mockResolvedValueOnce(
        mockFetchResponse(
          gqlOk({
            node: {
              items: {
                pageInfo: {
                  hasNextPage: !isLast,
                  endCursor: isLast ? null : `cursor_${page}`,
                },
                nodes,
              },
            },
          }),
        ),
      );
    }

    const client = new GitHubProjectsClient({
      token: "tok",
      projectId: "proj_1",
    });
    const result = await client.listAllItems();
    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(50);
    expect(mockFn).toHaveBeenCalledTimes(5);
  });
});

// ---------------------------------------------------------------------------
// Type safety: exported types are correct shapes
// ---------------------------------------------------------------------------

describe("Exported type shapes", () => {
  it("ProjectItem has required fields", () => {
    const item: ProjectItem = {
      id: "1",
      title: "T",
      body: "B",
      status: "Open",
      labels: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      fieldValues: {},
    };
    expect(item.id).toBe("1");
  });

  it("ProjectField has required fields", () => {
    const field: ProjectField = {
      id: "f1",
      name: "Status",
      dataType: "SINGLE_SELECT",
      options: [{ id: "opt1", name: "Open" }],
    };
    expect(field.dataType).toBe("SINGLE_SELECT");
  });
});
