import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (promise: Promise<unknown>) => {
    try {
      const data = await promise;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

import {
  approvePlan,
  buildSourceName,
  createSession,
  extractSessionId,
  getActivity,
  getSession,
  getSource,
  isJulesAvailable,
  listActivities,
  listSessions,
  listSources,
  sendMessage,
} from "./jules-client";

describe("jules-client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubEnv("JULES_API_KEY", "test-api-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  function mockFetchSuccess(data: unknown, status = 200) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(data),
    });
  }

  function mockFetchError(message: string) {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error(message),
    );
  }

  describe("isJulesAvailable", () => {
    it("should return true when API key is set", () => {
      expect(isJulesAvailable()).toBe(true);
    });

    it("should return false when API key is not set", () => {
      vi.stubEnv("JULES_API_KEY", "");
      expect(isJulesAvailable()).toBe(false);
    });
  });

  describe("listSources", () => {
    it("should build URL with pagination params", async () => {
      mockFetchSuccess({ sources: [{ name: "sources/github/owner/repo" }] });

      await listSources(10, "token123");

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("pageSize=10");
      expect(url).toContain("pageToken=token123");
    });

    it("should return sources on success", async () => {
      const expected = { sources: [{ name: "sources/github/o/r" }] };
      mockFetchSuccess(expected);

      const result = await listSources();

      expect(result.data).toEqual(expected);
      expect(result.error).toBeNull();
    });
  });

  describe("getSource", () => {
    it("should fetch by name", async () => {
      mockFetchSuccess({ name: "sources/github/o/r" });

      const result = await getSource("sources/github/o/r");

      expect(result.data).toEqual({ name: "sources/github/o/r" });
    });
  });

  describe("listSessions", () => {
    it("should return sessions with pagination", async () => {
      const expected = {
        sessions: [{ name: "sessions/abc", state: "COMPLETED" }],
        nextPageToken: "next",
      };
      mockFetchSuccess(expected);

      const result = await listSessions(5, "page1");

      expect(result.data).toEqual(expected);
      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("pageSize=5");
    });
  });

  describe("getSession", () => {
    it("should validate session ID", async () => {
      await expect(getSession("../evil")).rejects.toThrow(
        "Invalid session ID format",
      );
    });

    it("should normalize sessions/ prefix", async () => {
      mockFetchSuccess({ name: "sessions/abc", state: "COMPLETED" });

      await getSession("abc");

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("/sessions/abc");
    });

    it("should not duplicate sessions/ prefix", async () => {
      mockFetchSuccess({ name: "sessions/abc", state: "COMPLETED" });

      await getSession("sessions/abc");

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("/sessions/abc");
      expect(url).not.toContain("/sessions/sessions/");
    });
  });

  describe("createSession", () => {
    it("should POST with body", async () => {
      mockFetchSuccess({ name: "sessions/new", state: "QUEUED" });

      const request = {
        prompt: "Fix the bug",
        sourceContext: { source: "sources/github/o/r" },
      };
      const result = await createSession(request);

      expect(result.data).toEqual({ name: "sessions/new", state: "QUEUED" });
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]!;
      expect(fetchCall[1].method).toBe("POST");
      expect(fetchCall[1].body).toBe(JSON.stringify(request));
    });
  });

  describe("approvePlan", () => {
    it("should validate session ID", async () => {
      await expect(approvePlan("../bad")).rejects.toThrow(
        "Invalid session ID format",
      );
    });

    it("should POST to :approvePlan endpoint", async () => {
      mockFetchSuccess({ name: "sessions/abc", state: "IN_PROGRESS" });

      await approvePlan("abc");

      const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]![0] as string;
      expect(url).toContain("/sessions/abc:approvePlan");
    });
  });

  describe("sendMessage", () => {
    it("should validate session ID", async () => {
      await expect(sendMessage("foo/../bar", "hi")).rejects.toThrow(
        "Invalid session ID format",
      );
    });

    it("should POST with prompt", async () => {
      mockFetchSuccess({ name: "sessions/abc", state: "IN_PROGRESS" });

      await sendMessage("abc", "Hello");

      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
        .calls[0]!;
      expect(fetchCall[1].body).toBe(JSON.stringify({ prompt: "Hello" }));
    });
  });

  describe("listActivities", () => {
    it("should validate session ID", async () => {
      await expect(listActivities("a/../../b")).rejects.toThrow(
        "Invalid session ID format",
      );
    });

    it("should return activities with pagination", async () => {
      const expected = {
        activities: [{ name: "sessions/abc/activities/1" }],
      };
      mockFetchSuccess(expected);

      const result = await listActivities("abc", 10);

      expect(result.data).toEqual(expected);
    });
  });

  describe("getActivity", () => {
    it("should fetch by name", async () => {
      mockFetchSuccess({ name: "sessions/abc/activities/1" });

      const result = await getActivity("sessions/abc/activities/1");

      expect(result.data).toEqual({ name: "sessions/abc/activities/1" });
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      mockFetchError("Connection refused");

      const result = await listSources();

      expect(result.data).toBeNull();
      expect(result.error).toContain("Network error");
    });

    it("should handle API errors", async () => {
      mockFetchSuccess(
        { error: { code: 404, message: "Not found", status: "NOT_FOUND" } },
        404,
      );

      const result = await getSource("bad");

      expect(result.data).toBeNull();
      expect(result.error).toBe("Not found");
    });

    it("should handle JSON parse errors", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Unexpected token")),
      });

      const result = await listSources();

      expect(result.data).toBeNull();
      expect(result.error).toContain("Failed to parse");
    });

    it("should throw when API key is missing", async () => {
      vi.stubEnv("JULES_API_KEY", "");

      await expect(listSources()).rejects.toThrow(
        "JULES_API_KEY environment variable is not set",
      );
    });
  });

  describe("utility functions", () => {
    it("buildSourceName returns correct format", () => {
      expect(buildSourceName("owner", "repo")).toBe(
        "sources/github/owner/repo",
      );
    });

    it("extractSessionId strips prefix", () => {
      expect(extractSessionId("sessions/abc123")).toBe("abc123");
    });

    it("extractSessionId handles no prefix", () => {
      expect(extractSessionId("abc123")).toBe("abc123");
    });
  });
});
