import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText } from "../__test-utils__";
import { isJulesAvailable, registerJulesTools } from "./jules";

function mockJsonResponse(data: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(data) };
}

describe("jules tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JULES_API_KEY = "test-api-key";
    registry = createMockRegistry();
    registerJulesTools(registry, userId);
  });

  afterEach(() => {
    delete process.env.JULES_API_KEY;
  });

  it("isJulesAvailable returns true when key set", () => {
    expect(isJulesAvailable()).toBe(true);
  });

  it("should register 5 jules tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("jules_list_sessions")).toBe(true);
    expect(registry.handlers.has("jules_create_session")).toBe(true);
    expect(registry.handlers.has("jules_get_session")).toBe(true);
    expect(registry.handlers.has("jules_approve_plan")).toBe(true);
    expect(registry.handlers.has("jules_send_message")).toBe(true);
  });

  it("should not register when API key missing", () => {
    delete process.env.JULES_API_KEY;
    const reg2 = createMockRegistry();
    registerJulesTools(reg2, userId);
    expect(reg2.register).toHaveBeenCalledTimes(0);
  });

  describe("jules_list_sessions", () => {
    it("should list sessions", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({
        sessions: [{
          name: "sessions/abc",
          state: "COMPLETED",
          title: "Fix bug",
        }],
      }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("Fix bug");
      expect(getText(result)).toContain("COMPLETED");
    });

    it("should show empty message", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ sessions: [] }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("No sessions found");
    });

    it("should filter sessions by status parameter", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({
        sessions: [
          { name: "sessions/abc", state: "COMPLETED", title: "Done task" },
          { name: "sessions/def", state: "IN_PROGRESS", title: "Running task" },
        ],
      }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ status: "COMPLETED", page_size: 20 });
      expect(getText(result)).toContain("Done task");
      expect(getText(result)).not.toContain("Running task");
      expect(getText(result)).toContain("Sessions (1)");
    });

    it("should handle sessions undefined in response", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("No sessions found");
    });

    it("should show URL for sessions that have one", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({
        sessions: [{
          name: "sessions/abc",
          state: "IN_PROGRESS",
          title: "Task",
          url: "https://jules.google.com/sessions/abc",
        }],
      }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain(
        "URL: https://jules.google.com/sessions/abc",
      );
    });

    it("should display session name when title is missing", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({
        sessions: [{ name: "sessions/xyz", state: "QUEUED" }],
      }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("sessions/xyz");
    });

    it("should return error when API key is missing at request time", async () => {
      delete process.env.JULES_API_KEY;
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Jules API not configured");
    });

    it("should handle fetch throwing an error", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Network failure");
    });

    it("should handle non-Error thrown from fetch", async () => {
      mockFetch.mockRejectedValue("some string error");
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });

    it("should handle API error response without error.message field", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}, false));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 20 });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("API error");
    });

    it("should skip pageSize param and query string when page_size is 0", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ sessions: [] }));
      const handler = registry.handlers.get("jules_list_sessions")!;
      const result = await handler({ page_size: 0 });
      expect(getText(result)).toContain("No sessions found");
      // page_size=0 is falsy, so pageSize param should not be set
      // and the URL should not include a query string
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sessions$/),
        expect.any(Object),
      );
    });
  });

  describe("jules_create_session", () => {
    it("should create session", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ name: "sessions/new-123", state: "QUEUED" }),
      );
      const handler = registry.handlers.get("jules_create_session")!;
      const result = await handler({
        title: "New task",
        task: "Fix the login bug",
        starting_branch: "main",
      });
      expect(getText(result)).toContain("Jules Session Created");
      expect(getText(result)).toContain("QUEUED");
    });

    it("should handle API error", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ error: { message: "Rate limited" } }, false),
      );
      const handler = registry.handlers.get("jules_create_session")!;
      const result = await handler({
        title: "Task",
        task: "Do something",
        starting_branch: "main",
      });
      expect(getText(result)).toContain("Error");
    });

    it("should create session with explicit source_repo", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ name: "sessions/custom-123", state: "QUEUED" }),
      );
      const handler = registry.handlers.get("jules_create_session")!;
      const result = await handler({
        title: "Custom repo",
        task: "Fix it",
        source_repo: "myorg/myrepo",
        starting_branch: "develop",
      });
      expect(getText(result)).toContain("Jules Session Created");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("sources/github/myorg/myrepo"),
        }),
      );
    });

    it("should include URL when present in create response", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({
          name: "sessions/new-456",
          state: "QUEUED",
          url: "https://jules.google.com/sessions/new-456",
        }),
      );
      const handler = registry.handlers.get("jules_create_session")!;
      const result = await handler({
        title: "Task",
        task: "Do something",
        starting_branch: "main",
      });
      expect(getText(result)).toContain("URL:");
      expect(getText(result)).toContain(
        "https://jules.google.com/sessions/new-456",
      );
    });

    it("should not include URL when missing from response", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ name: "sessions/new-789", state: "QUEUED" }),
      );
      const handler = registry.handlers.get("jules_create_session")!;
      const result = await handler({
        title: "Task",
        task: "Do something",
        starting_branch: "main",
      });
      expect(getText(result)).not.toContain("URL:");
    });
  });

  describe("jules_get_session", () => {
    it("should get session with activities", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "COMPLETED",
            title: "Fix bug",
            planSummary: "Updated auth",
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({
            activities: [{ type: "code_change", content: "Modified auth.ts" }],
          }),
        );
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("Fix bug");
      expect(getText(result)).toContain("Updated auth");
      expect(getText(result)).toContain("Modified auth.ts");
    });

    it("should get session without planSummary", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "IN_PROGRESS",
            title: "Task",
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ activities: [] }));
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).not.toContain("Plan:");
      expect(getText(result)).toContain("Task");
    });

    it("should get session without URL", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({ name: "sessions/abc", state: "QUEUED" }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ activities: [] }));
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("Untitled");
      expect(getText(result)).not.toContain("URL:");
    });

    it("should get session with URL", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "COMPLETED",
            url: "https://jules.google.com/abc",
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ activities: [] }));
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("URL:");
    });

    it("should handle include_activities: false", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({
          name: "sessions/abc",
          state: "COMPLETED",
          title: "Task",
        }),
      );
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: false,
      });
      expect(getText(result)).toContain("Task");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle activities with empty array", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "COMPLETED",
            title: "Task",
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ activities: [] }));
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).not.toContain("Activities:");
    });

    it("should handle activities with missing type and content", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "COMPLETED",
            title: "Task",
          }),
        )
        .mockResolvedValueOnce(
          mockJsonResponse({ activities: [{}, { type: "note" }] }),
        );
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("Activity: (no content)");
      expect(getText(result)).toContain("note: (no content)");
    });

    it("should handle session_id with sessions/ prefix", async () => {
      mockFetch
        .mockResolvedValueOnce(
          mockJsonResponse({
            name: "sessions/abc",
            state: "COMPLETED",
            title: "Task",
          }),
        )
        .mockResolvedValueOnce(mockJsonResponse({ activities: [] }));
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "sessions/abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("Task");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/abc"),
        expect.any(Object),
      );
    });

    it("should throw on invalid session ID", async () => {
      const handler = registry.handlers.get("jules_get_session")!;
      await expect(
        handler({ session_id: "invalid!@#", include_activities: true }),
      ).rejects.toThrow("Invalid session ID format");
    });

    it("should handle error from session fetch", async () => {
      mockFetch.mockResolvedValueOnce(
        mockJsonResponse({ error: { message: "Not found" } }, false),
      );
      const handler = registry.handlers.get("jules_get_session")!;
      const result = await handler({
        session_id: "abc",
        include_activities: true,
      });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Not found");
    });
  });

  describe("jules_approve_plan", () => {
    it("should approve plan", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ state: "IN_PROGRESS" }));
      const handler = registry.handlers.get("jules_approve_plan")!;
      const result = await handler({ session_id: "abc" });
      expect(getText(result)).toContain("Plan Approved");
    });

    it("should show default status when state is missing", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({}));
      const handler = registry.handlers.get("jules_approve_plan")!;
      const result = await handler({ session_id: "abc" });
      expect(getText(result)).toContain("IN_PROGRESS");
    });

    it("should handle sessions/ prefix in session_id", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ state: "IN_PROGRESS" }));
      const handler = registry.handlers.get("jules_approve_plan")!;
      const result = await handler({ session_id: "sessions/abc" });
      expect(getText(result)).toContain("Plan Approved");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/abc:approvePlan"),
        expect.any(Object),
      );
    });

    it("should throw on invalid session ID", async () => {
      const handler = registry.handlers.get("jules_approve_plan")!;
      await expect(handler({ session_id: "bad id!" })).rejects.toThrow(
        "Invalid session ID format",
      );
    });

    it("should return error on API failure", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ error: { message: "Forbidden" } }, false),
      );
      const handler = registry.handlers.get("jules_approve_plan")!;
      const result = await handler({ session_id: "abc" });
      expect(getText(result)).toContain("Error");
    });
  });

  describe("jules_send_message", () => {
    it("should send message", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ state: "IN_PROGRESS" }));
      const handler = registry.handlers.get("jules_send_message")!;
      const result = await handler({
        session_id: "abc",
        message: "Please also fix tests",
      });
      expect(getText(result)).toContain("Message Sent");
    });

    it("should handle sessions/ prefix in session_id", async () => {
      mockFetch.mockResolvedValue(mockJsonResponse({ state: "IN_PROGRESS" }));
      const handler = registry.handlers.get("jules_send_message")!;
      const result = await handler({
        session_id: "sessions/abc",
        message: "Hello",
      });
      expect(getText(result)).toContain("Message Sent");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sessions/abc:sendMessage"),
        expect.any(Object),
      );
    });

    it("should throw on invalid session ID", async () => {
      const handler = registry.handlers.get("jules_send_message")!;
      await expect(handler({ session_id: "bad!id", message: "Hello" })).rejects
        .toThrow("Invalid session ID format");
    });

    it("should return error on API failure", async () => {
      mockFetch.mockResolvedValue(
        mockJsonResponse({ error: { message: "Session not active" } }, false),
      );
      const handler = registry.handlers.get("jules_send_message")!;
      const result = await handler({ session_id: "abc", message: "Hello" });
      expect(getText(result)).toContain("Error");
    });
  });
});
