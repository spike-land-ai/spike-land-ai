import { describe, expect, it } from "vitest";
import type {
  CreateSessionRequest,
  JulesActivity,
  JulesApiError,
  JulesSession,
  JulesSource,
  ListActivitiesResponse,
  ListSessionsResponse,
  ListSourcesResponse,
} from "./jules-types";

/**
 * Type-level tests for Jules API types.
 *
 * These tests verify that all exported types compile correctly
 * and that objects satisfying each interface hold the expected shape.
 */

describe("jules-types", () => {
  describe("JulesSession", () => {
    it("should create a session with required fields", () => {
      const session: JulesSession = {
        name: "sessions/abc123",
        state: "COMPLETED",
      };
      expect(session.name).toBe("sessions/abc123");
      expect(session.state).toBe("COMPLETED");
      expect(session.id).toBeUndefined();
      expect(session.createTime).toBeUndefined();
      expect(session.updateTime).toBeUndefined();
      expect(session.url).toBeUndefined();
      expect(session.title).toBeUndefined();
      expect(session.outputs).toBeUndefined();
      expect(session.planSummary).toBeUndefined();
    });

    it("should create a session with all optional fields", () => {
      const session: JulesSession = {
        name: "sessions/xyz789",
        id: "xyz789",
        state: "IN_PROGRESS",
        createTime: "2026-01-01T00:00:00Z",
        updateTime: "2026-01-01T01:00:00Z",
        url: "https://jules.google.com/sessions/xyz789",
        title: "Fix authentication bug",
        outputs: [
          {
            url: "https://github.com/org/repo/pull/42",
            title: "Fix auth",
            description: "Fixes #123",
          },
        ],
        planSummary: "Will update the auth module to handle edge cases",
      };
      expect(session.state).toBe("IN_PROGRESS");
      expect(session.outputs).toHaveLength(1);
      expect(session.outputs![0]!.url).toContain("pull/42");
    });

    it("should accept all valid session states", () => {
      const states: JulesSession["state"][] = [
        "QUEUED",
        "PLANNING",
        "AWAITING_PLAN_APPROVAL",
        "AWAITING_USER_FEEDBACK",
        "IN_PROGRESS",
        "PAUSED",
        "FAILED",
        "COMPLETED",
      ];
      expect(states).toHaveLength(8);
      for (const state of states) {
        const session: JulesSession = { name: "sessions/test", state };
        expect(session.state).toBe(state);
      }
    });
  });

  describe("JulesActivity", () => {
    it("should create an activity with required fields", () => {
      const activity: JulesActivity = {
        name: "sessions/abc123/activities/act1",
      };
      expect(activity.name).toContain("activities");
      expect(activity.type).toBeUndefined();
      expect(activity.content).toBeUndefined();
      expect(activity.createTime).toBeUndefined();
    });

    it("should create an activity with all fields", () => {
      const activity: JulesActivity = {
        name: "sessions/abc123/activities/act1",
        type: "code_change",
        content: "Updated src/auth.ts",
        createTime: "2026-01-01T00:30:00Z",
      };
      expect(activity.type).toBe("code_change");
      expect(activity.content).toContain("auth.ts");
    });
  });

  describe("JulesSource", () => {
    it("should create a source with required fields", () => {
      const source: JulesSource = {
        name: "sources/github/spike-land-ai/spike.land",
      };
      expect(source.name).toContain("github");
      expect(source.displayName).toBeUndefined();
    });

    it("should create a source with display name", () => {
      const source: JulesSource = {
        name: "sources/github/spike-land-ai/spike.land",
        displayName: "spike.land",
      };
      expect(source.displayName).toBe("spike.land");
    });
  });

  describe("CreateSessionRequest", () => {
    it("should create a request with required fields", () => {
      const req: CreateSessionRequest = {
        prompt: "Fix the failing tests in src/lib/auth",
        sourceContext: {
          source: "sources/github/spike-land-ai/spike.land",
        },
      };
      expect(req.prompt).toContain("failing tests");
      expect(req.sourceContext.source).toContain("github");
      expect(req.title).toBeUndefined();
      expect(req.requirePlanApproval).toBeUndefined();
      expect(req.automationMode).toBeUndefined();
    });

    it("should create a request with all fields", () => {
      const req: CreateSessionRequest = {
        prompt: "Add unit tests for the auth module",
        sourceContext: {
          source: "sources/github/spike-land-ai/spike.land",
          githubRepoContext: {
            startingBranch: "feature/auth-tests",
          },
        },
        title: "Add auth tests",
        requirePlanApproval: true,
        automationMode: "AUTO_CREATE_PR",
      };
      expect(req.sourceContext.githubRepoContext?.startingBranch).toBe("feature/auth-tests");
      expect(req.requirePlanApproval).toBe(true);
      expect(req.automationMode).toBe("AUTO_CREATE_PR");
    });
  });

  describe("ListSessionsResponse", () => {
    it("should create a response with sessions", () => {
      const response: ListSessionsResponse = {
        sessions: [
          { name: "sessions/1", state: "COMPLETED" },
          { name: "sessions/2", state: "QUEUED" },
        ],
      };
      expect(response.sessions).toHaveLength(2);
      expect(response.nextPageToken).toBeUndefined();
    });

    it("should create a response with pagination token", () => {
      const response: ListSessionsResponse = {
        sessions: [],
        nextPageToken: "token123",
      };
      expect(response.nextPageToken).toBe("token123");
    });
  });

  describe("ListActivitiesResponse", () => {
    it("should create a response with activities", () => {
      const response: ListActivitiesResponse = {
        activities: [{ name: "sessions/1/activities/a1" }],
      };
      expect(response.activities).toHaveLength(1);
      expect(response.nextPageToken).toBeUndefined();
    });

    it("should support pagination", () => {
      const response: ListActivitiesResponse = {
        activities: [],
        nextPageToken: "next-page",
      };
      expect(response.nextPageToken).toBe("next-page");
    });
  });

  describe("ListSourcesResponse", () => {
    it("should create a response with sources", () => {
      const response: ListSourcesResponse = {
        sources: [{ name: "sources/github/owner/repo" }],
      };
      expect(response.sources).toHaveLength(1);
      expect(response.nextPageToken).toBeUndefined();
    });

    it("should support pagination", () => {
      const response: ListSourcesResponse = {
        sources: [],
        nextPageToken: "token-abc",
      };
      expect(response.nextPageToken).toBe("token-abc");
    });
  });

  describe("JulesApiError", () => {
    it("should create an API error", () => {
      const error: JulesApiError = {
        error: {
          code: 404,
          message: "Session not found",
          status: "NOT_FOUND",
        },
      };
      expect(error.error.code).toBe(404);
      expect(error.error.message).toBe("Session not found");
      expect(error.error.status).toBe("NOT_FOUND");
    });

    it("should create a rate limit error", () => {
      const error: JulesApiError = {
        error: {
          code: 429,
          message: "Too many requests",
          status: "RESOURCE_EXHAUSTED",
        },
      };
      expect(error.error.code).toBe(429);
    });
  });
});
