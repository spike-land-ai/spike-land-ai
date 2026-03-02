import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useCleanSweep } from "./useCleanSweep";
import type { CleaningAchievement, CleaningSession, CleaningStreak } from "@/lib/clean/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStreak(overrides?: Partial<CleaningStreak>): CleaningStreak {
  return {
    currentStreak: 3,
    bestStreak: 7,
    totalPoints: 450,
    level: 2,
    totalSessions: 10,
    lastSessionDate: "2026-02-25",
    ...overrides,
  };
}

function makeSession(overrides?: Partial<CleaningSession>): CleaningSession {
  return {
    id: "session-1",
    userId: "user-1",
    status: "ACTIVE",
    tasks: [
      {
        id: "task-1",
        description: "Wipe kitchen counter",
        category: "SURFACE",
        difficulty: "QUICK",
        status: "PENDING",
        pointsValue: 10,
        order: 1,
      },
      {
        id: "task-2",
        description: "Sweep floor",
        category: "FLOOR",
        difficulty: "EASY",
        status: "PENDING",
        pointsValue: 20,
        order: 2,
      },
    ],
    totalPoints: 0,
    startedAt: "2026-02-26T10:00:00Z",
    ...overrides,
  };
}

function makeAchievement(overrides?: Partial<CleaningAchievement>): CleaningAchievement {
  return {
    type: "FIRST_SESSION",
    name: "First Steps",
    description: "Complete your first cleaning session",
    unlockedAt: "2026-02-26T10:30:00Z",
    ...overrides,
  };
}

// ── Fetch mock setup ──────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function mockFetchSuccess(data: unknown): void {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status: number, error: string): void {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve({ error }),
  });
}

function mockFetchNetworkFailure(message = "Network error"): void {
  fetchMock.mockRejectedValueOnce(new Error(message));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useCleanSweep", () => {
  describe("initial data load", () => {
    it("fetches streak, recent sessions, and achievements on mount", async () => {
      const streak = makeStreak();
      const sessions = [makeSession({ status: "COMPLETED" })];
      const achievements = [makeAchievement()];

      mockFetchSuccess(streak);
      mockFetchSuccess(sessions);
      mockFetchSuccess(achievements);

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => {
        expect(result.current.streakLoading).toBe(false);
      });

      expect(result.current.streak).toEqual(streak);
      expect(result.current.recentSessions).toEqual(sessions);
      expect(result.current.achievements).toEqual(achievements);
    });

    it("shows streakLoading as true during initial fetch", async () => {
      let resolveStreak!: (v: unknown) => void;
      fetchMock.mockReturnValueOnce(
        new Promise((res) => {
          resolveStreak = res;
        }),
      );
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      expect(result.current.streakLoading).toBe(true);

      await act(async () => {
        resolveStreak({ ok: true, json: () => Promise.resolve(makeStreak()) });
      });
    });

    it("sets streakError when streak fetch fails", async () => {
      mockFetchError(500, "Internal Server Error");
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => {
        expect(result.current.streakLoading).toBe(false);
      });

      expect(result.current.streakError).toBe("Internal Server Error");
      expect(result.current.streak).toBeNull();
    });

    it("silently ignores recent sessions fetch failure", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchNetworkFailure("Sessions failed");
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => {
        expect(result.current.recentLoading).toBe(false);
      });

      expect(result.current.recentSessions).toEqual([]);
    });

    it("silently ignores achievements fetch failure", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchNetworkFailure("Achievements failed");

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => {
        expect(result.current.achievementsLoading).toBe(false);
      });

      expect(result.current.achievements).toEqual([]);
    });

    it("calls correct API endpoints on mount", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      renderHook(() => useCleanSweep());

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(3);
      });

      const urls = fetchMock.mock.calls.map((call) => call[0] as string);
      expect(urls).toContain("/api/clean/streaks");
      expect(urls).toContain("/api/clean/sessions?limit=5");
      expect(urls).toContain("/api/clean/achievements");
    });
  });

  // ── refreshStreak ──────────────────────────────────────────────────────────

  describe("refreshStreak", () => {
    it("updates streak data on manual refresh", async () => {
      const initial = makeStreak({ currentStreak: 1 });
      const updated = makeStreak({ currentStreak: 5 });

      mockFetchSuccess(initial);
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(updated);
      await act(async () => {
        await result.current.refreshStreak();
      });

      expect(result.current.streak?.currentStreak).toBe(5);
    });

    it("sets streakError when refresh fails", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchError(401, "Unauthorized");
      await act(async () => {
        await result.current.refreshStreak();
      });

      expect(result.current.streakError).toBe("Unauthorized");
    });
  });

  // ── startSession ───────────────────────────────────────────────────────────

  describe("startSession", () => {
    it("returns the new session and sets state", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const newSession = makeSession();
      mockFetchSuccess(newSession);

      let returnedSession: CleaningSession | null = null;
      await act(async () => {
        returnedSession = await result.current.startSession("base64photo");
      });

      expect(returnedSession).toEqual(newSession);
      expect(result.current.session).toEqual(newSession);
      expect(result.current.sessionError).toBeNull();
    });

    it("posts to correct endpoint with room photo", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(makeSession());
      await act(async () => {
        await result.current.startSession("my-photo-base64");
      });

      // Just verify the POST was made with correct body
      const postCall = fetchMock.mock.calls.find(
        (call) => call[0] === "/api/clean/sessions" && (call[1] as RequestInit)?.method === "POST",
      );
      expect(postCall).toBeDefined();
      expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
        roomPhoto: "my-photo-base64",
      });
    });

    it("returns null and sets sessionError on failure", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchError(422, "Invalid photo");
      let returnedSession: CleaningSession | null = undefined as unknown as CleaningSession | null;
      await act(async () => {
        returnedSession = await result.current.startSession("bad-photo");
      });

      expect(returnedSession).toBeNull();
      expect(result.current.sessionError).toBe("Invalid photo");
    });
  });

  // ── completeTask ───────────────────────────────────────────────────────────

  describe("completeTask", () => {
    it("does nothing when no session is active", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      await act(async () => {
        await result.current.completeTask("task-1");
      });

      // Only the 3 initial calls, no additional task complete call
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("updates the task in session state", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const session = makeSession();
      mockFetchSuccess(session);
      await act(async () => {
        await result.current.startSession("photo");
      });

      const completedTask = {
        ...session.tasks[0],
        status: "COMPLETED" as const,
        completedAt: "2026-02-26T10:05:00Z",
      };
      mockFetchSuccess(completedTask);
      await act(async () => {
        await result.current.completeTask("task-1");
      });

      expect(result.current.session?.tasks[0]!.status).toBe("COMPLETED");
    });

    it("posts to correct complete endpoint", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const session = makeSession();
      mockFetchSuccess(session);
      await act(async () => {
        await result.current.startSession("photo");
      });

      mockFetchSuccess({ ...session.tasks[0], status: "COMPLETED" });
      await act(async () => {
        await result.current.completeTask("task-1");
      });

      const completeCall = fetchMock.mock.calls.find((call) =>
        (call[0] as string).includes("/tasks/task-1/complete"),
      );
      expect(completeCall).toBeDefined();
      expect((completeCall![1] as RequestInit).method).toBe("POST");
    });

    it("sets sessionError when complete task fails", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(makeSession());
      await act(async () => {
        await result.current.startSession("photo");
      });

      mockFetchError(500, "Task complete failed");
      await act(async () => {
        await result.current.completeTask("task-1");
      });

      expect(result.current.sessionError).toBe("Task complete failed");
    });
  });

  // ── skipTask ───────────────────────────────────────────────────────────────

  describe("skipTask", () => {
    it("does nothing when no session is active", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      await act(async () => {
        await result.current.skipTask("task-1", "too hard");
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("updates the task status to SKIPPED in session state", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const session = makeSession();
      mockFetchSuccess(session);
      await act(async () => {
        await result.current.startSession("photo");
      });

      const skippedTask = {
        ...session.tasks[0],
        status: "SKIPPED" as const,
        skipReason: "too hard",
      };
      mockFetchSuccess(skippedTask);
      await act(async () => {
        await result.current.skipTask("task-1", "too hard");
      });

      expect(result.current.session?.tasks[0]!.status).toBe("SKIPPED");
    });

    it("posts reason to skip endpoint", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(makeSession());
      await act(async () => {
        await result.current.startSession("photo");
      });

      mockFetchSuccess({ ...makeSession().tasks[0], status: "SKIPPED" });
      await act(async () => {
        await result.current.skipTask("task-1", "back pain");
      });

      const skipCall = fetchMock.mock.calls.find((call) =>
        (call[0] as string).includes("/tasks/task-1/skip"),
      );
      expect(skipCall).toBeDefined();
      expect(JSON.parse((skipCall![1] as RequestInit).body as string)).toEqual({
        reason: "back pain",
      });
    });
  });

  // ── requeueSkipped ─────────────────────────────────────────────────────────

  describe("requeueSkipped", () => {
    it("does nothing when no session is active", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      await act(async () => {
        await result.current.requeueSkipped();
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("updates session with requeued tasks", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const session = makeSession();
      mockFetchSuccess(session);
      await act(async () => {
        await result.current.startSession("photo");
      });

      const requeuedSession = {
        ...session,
        tasks: session.tasks.map((t) => ({ ...t, status: "PENDING" as const })),
      };
      mockFetchSuccess(requeuedSession);
      await act(async () => {
        await result.current.requeueSkipped();
      });

      expect(result.current.session).toEqual(requeuedSession);
    });
  });

  // ── endSession ─────────────────────────────────────────────────────────────

  describe("endSession", () => {
    it("does nothing when no session is active", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      await act(async () => {
        await result.current.endSession();
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("updates session to COMPLETED and refreshes streak/recent/achievements", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      const session = makeSession();
      mockFetchSuccess(session);
      await act(async () => {
        await result.current.startSession("photo");
      });

      const completedSession = { ...session, status: "COMPLETED" as const, totalPoints: 30 };
      mockFetchSuccess(completedSession);

      // endSession calls refreshStreak, fetchRecentSessions, fetchAchievements
      const updatedStreak = makeStreak({ currentStreak: 4, totalPoints: 480 });
      mockFetchSuccess(updatedStreak);
      mockFetchSuccess([completedSession]);
      mockFetchSuccess([makeAchievement()]);

      await act(async () => {
        await result.current.endSession();
      });

      expect(result.current.session?.status).toBe("COMPLETED");
      expect(result.current.streak?.currentStreak).toBe(4);
    });

    it("sets sessionError when end session fails", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(makeSession());
      await act(async () => {
        await result.current.startSession("photo");
      });

      mockFetchError(500, "Failed to end session");
      await act(async () => {
        await result.current.endSession();
      });

      expect(result.current.sessionError).toBe("Failed to end session");
    });
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  describe("derived loading and error state", () => {
    it("loading is true when streakLoading is true", async () => {
      let resolveStreak!: (v: Response) => void;
      fetchMock.mockReturnValueOnce(
        new Promise<Response>((res) => {
          resolveStreak = res;
        }),
      );
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      expect(result.current.loading).toBe(true);

      await act(async () => {
        resolveStreak({ ok: true, json: () => Promise.resolve(makeStreak()) } as Response);
      });
    });

    it("error reflects streakError when present", async () => {
      mockFetchError(500, "Streak service down");
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());

      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      expect(result.current.error).toBe("Streak service down");
    });

    it("error reflects sessionError when streakError is null", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());
      await waitFor(() => expect(result.current.streakLoading).toBe(false));

      mockFetchSuccess(makeSession());
      await act(async () => {
        await result.current.startSession("photo");
      });

      mockFetchError(500, "Task error");
      await act(async () => {
        await result.current.completeTask("task-1");
      });

      expect(result.current.error).toBe("Task error");
    });
  });

  // ── De-duplication guard (fetchingRef) ─────────────────────────────────────

  describe("concurrent fetch deduplication", () => {
    it("does not fire concurrent refreshStreak calls", async () => {
      mockFetchSuccess(makeStreak());
      mockFetchSuccess([]);
      mockFetchSuccess([]);

      const { result } = renderHook(() => useCleanSweep());

      // Queue a second refreshStreak before the first completes
      let resolveExtra!: (v: unknown) => void;
      fetchMock.mockReturnValueOnce(
        new Promise((res) => {
          resolveExtra = res;
        }),
      );

      await act(async () => {
        // First call already in-flight from mount; second should be ignored
        void result.current.refreshStreak();
        void result.current.refreshStreak();
        resolveExtra({ ok: true, json: () => Promise.resolve(makeStreak()) });
      });

      await waitFor(() => expect(result.current.streakLoading).toBe(false));
      // Should not have made more than the initial 3 + 1 refresh calls
      expect(
        fetchMock.mock.calls.filter((call) => call[0] === "/api/clean/streaks").length,
      ).toBeLessThanOrEqual(2);
    });
  });
});
