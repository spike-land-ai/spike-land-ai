import { afterEach, describe, expect, it, vi } from "vitest";
import type { TerminalSessionSnapshot } from "./types";

const originalHome = process.env["HOME"];

async function loadStoreWithHome(home: string) {
  process.env["HOME"] = home;
  vi.resetModules();
  return import("./session-journal");
}

function buildSnapshot(sessionId: string): TerminalSessionSnapshot {
  return {
    sessionId,
    conversationId: sessionId,
    cwd: "/tmp/workspace",
    repo: { root: "/tmp/workspace", name: "workspace" },
    model: "claude-sonnet-4-6",
    baseUrl: "https://spike.land",
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-12T10:00:00.000Z",
    messages: [{ role: "user", content: "hello" }],
    sessionState: {
      created: {},
      idsByKey: {},
      configToolsCalled: [],
    },
    registry: {
      activeToolNames: ["spike__tool_search"],
    },
    runtime: null,
    pendingTurn: {
      id: "turn-1",
      userInput: "hello",
      status: "streaming",
      assistantText: "partial response",
      toolCalls: [],
      startedAt: "2026-03-12T10:00:00.000Z",
      lastUpdatedAt: "2026-03-12T10:00:01.000Z",
    },
  };
}

describe("SessionJournalStore", () => {
  afterEach(() => {
    if (originalHome) {
      process.env["HOME"] = originalHome;
    } else {
      delete process.env["HOME"];
    }
  });

  it("persists snapshots and journal events for a resumable session", async () => {
    const home = await import("node:fs/promises").then(async ({ mkdtemp }) => {
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      return mkdtemp(join(tmpdir(), "spike-terminal-home-"));
    });

    const { SessionJournalStore } = await loadStoreWithHome(home);
    const store = new SessionJournalStore();
    const snapshot = buildSnapshot("session-a");

    await store.claimOwnership("session-a", "owner-a");
    await store.writeSnapshot(snapshot);
    await store.appendEvent("session-a", {
      type: "streamed_delta",
      timestamp: "2026-03-12T10:00:01.000Z",
      payload: {
        type: "streamed_delta",
        sessionId: "session-a",
        turnId: "turn-1",
        text: "partial response",
      },
    });

    const journal = await store.load("session-a");
    expect(journal.snapshot).toEqual(snapshot);
    expect(journal.events).toHaveLength(1);
    expect(journal.events[0]?.payload.type).toBe("streamed_delta");
  });

  it("prevents a second live owner from taking the same session", async () => {
    const home = await import("node:fs/promises").then(async ({ mkdtemp }) => {
      const { join } = await import("node:path");
      const { tmpdir } = await import("node:os");
      return mkdtemp(join(tmpdir(), "spike-terminal-home-"));
    });

    const { SessionJournalStore } = await loadStoreWithHome(home);
    const store = new SessionJournalStore();

    await store.claimOwnership("session-b", "owner-a");

    await expect(store.claimOwnership("session-b", "owner-b")).rejects.toThrow(/already owned/i);
  });
});
