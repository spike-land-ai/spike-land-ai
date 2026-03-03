import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ========================================
// Hoisted mocks
// ========================================
const {
  mockGitHubProjectsClient,
  mockIsGitHubProjectsAvailable,
} = vi.hoisted(() => ({
  mockGitHubProjectsClient: {
    listItems: vi.fn(),
    listAllItems: vi.fn(),
    createIssue: vi.fn(),
    updateItemField: vi.fn(),
    getPRStatus: vi.fn(),
    getRateLimitInfo: vi.fn(),
    addItemToProject: vi.fn(),
  },
  mockIsGitHubProjectsAvailable: vi.fn(),
}));

vi.mock("@/lib/sync/clients/github-projects-client", () => ({
  isGitHubProjectsAvailable: mockIsGitHubProjectsAvailable,
  GitHubProjectsClient: vi.fn(() => mockGitHubProjectsClient),
}));

vi.mock("@/lib/sync/create-sync-clients", () => ({
  createGitHubProjectsClient: () => mockGitHubProjectsClient,
}));

// Must import AFTER mocks
import {
  isBoltPaused,
  isGatewayAvailable,
  registerGatewayTools,
  resetBoltState,
} from "./gateway";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolDefinition } from "../tool-registry";

// ========================================
// Test Helpers
// ========================================

/** Extract text from a CallToolResult content array */
function textOf(
  result: { content: Array<{ type: string; text?: string; }>; },
): string {
  return result.content
    .filter((c): c is { type: "text"; text: string; } => c.type === "text")
    .map(c => c.text)
    .join("\n");
}

class MockToolRegistry {
  tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    this.tools.set(def.name, def);
  }

  getHandler(name: string) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    return tool.handler as (
      input: Record<string, unknown>,
    ) => Promise<CallToolResult> | CallToolResult;
  }
}

// ========================================
// Tests
// ========================================

describe("gateway tools", () => {
  let registry: MockToolRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MockToolRegistry();
    resetBoltState();
  });

  afterEach(() => {
    resetBoltState();
  });

  // ---- isGatewayAvailable ----
  describe("isGatewayAvailable", () => {
    it("returns true when GitHub is available", () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(true);
      expect(isGatewayAvailable()).toBe(true);
    });

    it("returns false when GitHub is not available", () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(false);
      expect(isGatewayAvailable()).toBe(false);
    });
  });

  // ---- isBoltPaused ----
  describe("isBoltPaused", () => {
    it("defaults to false", () => {
      expect(isBoltPaused()).toBe(false);
    });
  });

  // ---- Conditional registration ----
  describe("conditional registration", () => {
    it("registers 7 tools when GitHub available (4 GH + 3 bolt)", () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(true);
      registerGatewayTools(registry as never, "user-1");
      expect(registry.tools.size).toBe(7);
      expect(registry.tools.has("github_list_issues")).toBe(true);
      expect(registry.tools.has("bolt_status")).toBe(true);
    });

    it("registers only 3 bolt tools when GitHub not available", () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(false);
      registerGatewayTools(registry as never, "user-1");
      expect(registry.tools.size).toBe(3);
      expect(registry.tools.has("bolt_status")).toBe(true);
      expect(registry.tools.has("bolt_pause")).toBe(true);
      expect(registry.tools.has("bolt_resume")).toBe(true);
    });

    it("all tools have category=gateway and tier=workspace", () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(true);
      registerGatewayTools(registry as never, "user-1");
      for (const [, def] of registry.tools) {
        expect(def.category).toBe("gateway");
        expect(def.tier).toBe("workspace");
      }
    });
  });

  // ---- GitHub handlers ----
  describe("GitHub tools", () => {
    beforeEach(() => {
      mockIsGitHubProjectsAvailable.mockReturnValue(true);
      registerGatewayTools(registry as never, "user-1");
    });

    it("github_list_issues — success", async () => {
      mockGitHubProjectsClient.listItems.mockResolvedValue({
        data: {
          items: [
            {
              id: "i1",
              title: "Fix bug",
              status: "open",
              issueNumber: 42,
              labels: ["bug"],
            },
          ],
        },
        error: null,
      });

      const handler = registry.getHandler("github_list_issues");
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("Fix bug");
      expect(textOf(result)).toContain("#42");
    });

    it("github_list_issues — error", async () => {
      mockGitHubProjectsClient.listItems.mockResolvedValue({
        data: null,
        error: "Rate limited",
      });

      const handler = registry.getHandler("github_list_issues");
      const result = await handler({});
      expect(result.isError).toBe(true);
    });

    it("github_list_issues — items without issueNumber or labels", async () => {
      mockGitHubProjectsClient.listItems.mockResolvedValue({
        data: {
          items: [
            {
              id: "i2",
              title: "Draft issue",
              status: "backlog",
              labels: [],
            },
          ],
        },
        error: null,
      });

      const handler = registry.getHandler("github_list_issues");
      const result = await handler({});
      expect(textOf(result)).toContain("Draft issue");
      expect(textOf(result)).not.toContain("#");
    });

    it("github_create_issue — success", async () => {
      mockGitHubProjectsClient.createIssue.mockResolvedValue({
        data: { number: 100, url: "https://github.com/test/100" },
        error: null,
      });

      const handler = registry.getHandler("github_create_issue");
      const result = await handler({
        title: "New Issue",
        body: "Description",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("#100");
    });

    it("github_create_issue — error", async () => {
      mockGitHubProjectsClient.createIssue.mockResolvedValue({
        data: null,
        error: "Auth failed",
      });

      const handler = registry.getHandler("github_create_issue");
      const result = await handler({
        title: "X",
        body: "Y",
      });
      expect(result.isError).toBe(true);
    });

    it("github_update_project_item — success", async () => {
      mockGitHubProjectsClient.updateItemField.mockResolvedValue({
        data: true,
        error: null,
      });

      const handler = registry.getHandler("github_update_project_item");
      const result = await handler({
        item_id: "item1",
        field_id: "field1",
        value: "Done",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("updated successfully");
    });

    it("github_update_project_item — error", async () => {
      mockGitHubProjectsClient.updateItemField.mockResolvedValue({
        data: false,
        error: "Not found",
      });

      const handler = registry.getHandler("github_update_project_item");
      const result = await handler({
        item_id: "x",
        field_id: "y",
        value: "z",
      });
      expect(result.isError).toBe(true);
    });

    it("github_list_issues — data with missing items key", async () => {
      mockGitHubProjectsClient.listItems.mockResolvedValue({
        data: {},
        error: null,
      });

      const handler = registry.getHandler("github_list_issues");
      const result = await handler({});
      expect(textOf(result)).toContain("GitHub Project Items (0)");
    });

    it("github_get_pr_status — with linked PR", async () => {
      mockGitHubProjectsClient.getPRStatus.mockResolvedValue({
        data: {
          prNumber: 55,
          prState: "OPEN",
          ciStatus: "SUCCESS",
          reviewDecision: "APPROVED",
          mergedAt: null,
        },
        error: null,
      });

      const handler = registry.getHandler("github_get_pr_status");
      const result = await handler({ issue_number: 42 });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("#55");
      expect(textOf(result)).toContain("APPROVED");
    });

    it("github_get_pr_status — no linked PR", async () => {
      mockGitHubProjectsClient.getPRStatus.mockResolvedValue({
        data: { prNumber: null, prState: null },
        error: null,
      });

      const handler = registry.getHandler("github_get_pr_status");
      const result = await handler({ issue_number: 99 });
      expect(textOf(result)).toContain("No linked PR found");
    });

    it("github_get_pr_status — merged PR", async () => {
      mockGitHubProjectsClient.getPRStatus.mockResolvedValue({
        data: {
          prNumber: 60,
          prState: "MERGED",
          ciStatus: "SUCCESS",
          reviewDecision: "APPROVED",
          mergedAt: "2025-01-15T00:00:00Z",
        },
        error: null,
      });

      const handler = registry.getHandler("github_get_pr_status");
      const result = await handler({ issue_number: 50 });
      expect(textOf(result)).toContain("Merged:");
    });

    it("github_get_pr_status — null ciStatus and reviewDecision", async () => {
      mockGitHubProjectsClient.getPRStatus.mockResolvedValue({
        data: {
          prNumber: 70,
          prState: "OPEN",
          ciStatus: null,
          reviewDecision: null,
          mergedAt: null,
        },
        error: null,
      });

      const handler = registry.getHandler("github_get_pr_status");
      const result = await handler({ issue_number: 70 });
      expect(textOf(result)).toContain("CI:** unknown");
      expect(textOf(result)).toContain("Review:** none");
    });

    it("github_get_pr_status — error", async () => {
      mockGitHubProjectsClient.getPRStatus.mockResolvedValue({
        data: null,
        error: "API error",
      });

      const handler = registry.getHandler("github_get_pr_status");
      const result = await handler({ issue_number: 1 });
      expect(result.isError).toBe(true);
    });
  });

  // ---- Bolt handlers ----
  describe("Bolt tools", () => {
    beforeEach(() => {
      mockIsGitHubProjectsAvailable.mockReturnValue(false);
      registerGatewayTools(registry as never, "user-1");
    });

    it("bolt_status — running with no services", async () => {
      const handler = registry.getHandler("bolt_status");
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("RUNNING");
      expect(textOf(result)).toContain("not configured");
    });

    it("bolt_status — paused", async () => {
      // Pause first
      const pauseHandler = registry.getHandler("bolt_pause");
      await pauseHandler({});

      const handler = registry.getHandler("bolt_status");
      const result = await handler({});
      expect(textOf(result)).toContain("PAUSED");
    });

    it("bolt_status — with GitHub configured", async () => {
      mockIsGitHubProjectsAvailable.mockReturnValue(true);
      registry = new MockToolRegistry();
      registerGatewayTools(registry as never, "user-1");

      const handler = registry.getHandler("bolt_status");
      const result = await handler({});
      expect(textOf(result)).toContain("GitHub Projects:** configured");
    });

    it("bolt_pause — sets paused state", async () => {
      const handler = registry.getHandler("bolt_pause");
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("paused");
      expect(isBoltPaused()).toBe(true);
    });

    it("bolt_resume — clears paused state", async () => {
      // Pause first
      const pauseHandler = registry.getHandler("bolt_pause");
      await pauseHandler({});
      expect(isBoltPaused()).toBe(true);

      const handler = registry.getHandler("bolt_resume");
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain("resumed");
      expect(isBoltPaused()).toBe(false);
    });
  });
});
