/**
 * Tests for GitHubProjectsClient — error handling and utility functions
 *
 * Covers:
 * - isGitHubProjectsAvailable() (module-level function)
 * - Exported type shapes (ProjectItem, ProjectField)
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  isGitHubProjectsAvailable,
  type ProjectField,
  type ProjectItem,
} from "./github-projects-client";

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
