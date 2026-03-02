/**
 * Tests for workspace-state.ts
 */

import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { writeFile, unlink } from "node:fs/promises";

vi.mock("node:fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn(),
}));

import {
  enterWorkspace,
  exitWorkspace,
  getWorkspace,
  isWorkspaceActive,
  getConfigPath,
  resetWorkspaceState,
} from "./workspace-state.js";

describe("workspace-state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWorkspaceState();
  });

  afterEach(async () => {
    resetWorkspaceState();
  });

  it("starts with no workspace", () => {
    expect(getWorkspace()).toBeNull();
    expect(isWorkspaceActive()).toBe(false);
  });

  it("enterWorkspace sets state and calls writeFile", async () => {
    await enterWorkspace({
      packageName: "test-pkg",
      packagePath: "packages/test-pkg/",
      allowedPaths: ["packages/test-pkg/", "CLAUDE.md"],
      dependencies: [],
      enteredAt: "2026-03-02T00:00:00Z",
    });

    expect(getWorkspace()).not.toBeNull();
    expect(getWorkspace()!.packageName).toBe("test-pkg");
    expect(isWorkspaceActive()).toBe(true);

    expect(writeFile).toHaveBeenCalledWith(
      getConfigPath(),
      expect.stringContaining('"packageName": "test-pkg"')
    );
  });

  it("exitWorkspace clears state and calls unlink", async () => {
    await enterWorkspace({
      packageName: "test-pkg",
      packagePath: "packages/test-pkg/",
      allowedPaths: ["packages/test-pkg/"],
      dependencies: [],
      enteredAt: "2026-03-02T00:00:00Z",
    });

    await exitWorkspace();
    expect(getWorkspace()).toBeNull();
    expect(isWorkspaceActive()).toBe(false);
    expect(unlink).toHaveBeenCalledWith(getConfigPath());
  });

  it("exitWorkspace handles missing config file gracefully", async () => {
    vi.mocked(unlink).mockRejectedValue(new Error("ENOENT"));
    await expect(exitWorkspace()).resolves.not.toThrow();
  });

  it("getConfigPath returns expected path", () => {
    expect(getConfigPath()).toBe("/tmp/bazdmeg-workspace.json");
  });

  it("resetWorkspaceState clears in-memory state", async () => {
    await enterWorkspace({
      packageName: "test-pkg",
      packagePath: "packages/test-pkg/",
      allowedPaths: [],
      dependencies: [],
      enteredAt: "2026-03-02T00:00:00Z",
    });

    resetWorkspaceState();
    expect(getWorkspace()).toBeNull();
    expect(isWorkspaceActive()).toBe(false);
  });
});
