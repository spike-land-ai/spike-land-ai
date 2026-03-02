/**
 * Tests for GitHubProjectsClient — write/mutation operations
 *
 * Covers:
 * - createIssue()
 * - addItemToProject()
 * - updateItemField()
 */

import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from "vitest";
import { GitHubProjectsClient } from "./github-projects-client";

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
function gqlOk<T>(data: T): { data: T; errors?: never } {
  return { data };
}

/** Convenience: build a GraphQL error envelope */
function gqlErrors(...messages: string[]): { data?: never; errors: Array<{ message: string }> } {
  return { errors: messages.map((message) => ({ message })) };
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
      variables: { labelIds?: string[] };
    };
    expect(body.variables.labelIds).toEqual(["lbl_bug", "lbl_p1"]);
  });

  it("creates an issue even when labels array is empty", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(repoIdResponse)).mockResolvedValueOnce(
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
    fetchMock.mockResolvedValueOnce(mockFetchResponse(gqlErrors("Repository not found")));

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
    const body = JSON.parse(fetchMock.mock.calls[2]![1]!.body as string) as {
      variables: { labelIds?: string[] };
    };
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

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      variables: { projectId: string; contentId: string };
    };
    expect(body.variables.projectId).toBe("PROJ_SPECIFIC");
    expect(body.variables.contentId).toBe("ISSUE_ID");
  });

  it("returns error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(gqlErrors("Content not found")));

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

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as {
      variables: {
        projectId: string;
        itemId: string;
        fieldId: string;
        value: { text: string };
      };
    };
    expect(body.variables.projectId).toBe("proj_1");
    expect(body.variables.itemId).toBe("ITEM_ID");
    expect(body.variables.fieldId).toBe("FIELD_ID");
    expect(body.variables.value).toEqual({ text: "Hello" });
  });

  it("returns false and error on GraphQL error", async () => {
    fetchMock.mockResolvedValueOnce(mockFetchResponse(gqlErrors("Field not found")));

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
