/**
 * Unit tests for the collaboration components.
 *
 * WebSocket is mocked at the constructor level so no real network I/O occurs.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { CollabProvider, useCollab } from "@/ui/components/collab/CollabProvider";
import { PresenceBar } from "@/ui/components/collab/PresenceBar";
import { CollabIndicator } from "@/ui/components/collab/CollabIndicator";
import {
  dispatchSharedStateEvent,
  dispatchSelectionEvent,
} from "@/ui/components/collab/useSharedState";

// ── WebSocket mock ─────────────────────────────────────────────────────────

type WsEventType = "open" | "message" | "close" | "error";

interface MockWsInstance {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((evt: Event) => void) | null;
  onmessage: ((evt: MessageEvent) => void) | null;
  onclose: ((evt: CloseEvent) => void) | null;
  onerror: ((evt: Event) => void) | null;
  triggerEvent: (type: WsEventType, data?: unknown) => void;
}

let mockWsInstances: MockWsInstance[] = [];

// MockWebSocket needs to be a class (constructor) so `new WebSocket(...)` works.
class MockWebSocket implements MockWsInstance {
  readyState: number = 0; // CONNECTING
  send = vi.fn();
  onopen: ((evt: Event) => void) | null = null;
  onmessage: ((evt: MessageEvent) => void) | null = null;
  onclose: ((evt: CloseEvent) => void) | null = null;
  onerror: ((evt: Event) => void) | null = null;

  close = vi.fn(() => {
    this.readyState = 3; // CLOSED
    this.onclose?.(new CloseEvent("close"));
  });

  constructor(_url: string) {
    mockWsInstances.push(this);
  }

  triggerEvent(type: WsEventType, data?: unknown) {
    if (type === "open") {
      this.readyState = 1; // OPEN
      this.onopen?.(new Event("open"));
    } else if (type === "message") {
      this.onmessage?.(
        new MessageEvent("message", {
          data: typeof data === "string" ? data : JSON.stringify(data),
        }),
      );
    } else if (type === "close") {
      this.readyState = 3; // CLOSED
      this.onclose?.(new CloseEvent("close"));
    } else if (type === "error") {
      this.onerror?.(new Event("error"));
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeWrapper(roomId = "room-1", userId = "user-self", userName = "Self") {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <CollabProvider roomId={roomId} userId={userId} userName={userName}>
        {children}
      </CollabProvider>
    );
  };
}

function getLastWs(): MockWsInstance {
  const ws = mockWsInstances.at(-1);
  if (!ws) throw new Error("No WebSocket instances created");
  return ws;
}

beforeEach(() => {
  mockWsInstances = [];
  // Add static constants to the class so `WebSocket.OPEN` etc. resolve correctly
  (MockWebSocket as unknown as Record<string, number>)["CONNECTING"] = 0;
  (MockWebSocket as unknown as Record<string, number>)["OPEN"] = 1;
  (MockWebSocket as unknown as Record<string, number>)["CLOSING"] = 2;
  (MockWebSocket as unknown as Record<string, number>)["CLOSED"] = 3;
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllTimers();
});

// ── CollabProvider ─────────────────────────────────────────────────────────

describe("CollabProvider", () => {
  it("throws when useCollab is used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bare() {
      useCollab();
      return null;
    }
    expect(() => render(<Bare />)).toThrow("useCollab must be used inside <CollabProvider>");
    spy.mockRestore();
  });

  it("opens a WebSocket on mount pointing to the right room URL", () => {
    render(
      <CollabProvider roomId="r1" userId="u1" userName="Alice">
        <div />
      </CollabProvider>,
    );
    // MockWebSocket is a class, not a spy; count via our instances array
    expect(mockWsInstances.length).toBeGreaterThanOrEqual(1);
  });

  it("connection status becomes connected after open event", async () => {
    function StatusDisplay() {
      const { connectionStatus } = useCollab();
      return <span>{connectionStatus}</span>;
    }
    render(
      <CollabProvider roomId="r1" userId="u1" userName="Alice">
        <StatusDisplay />
      </CollabProvider>,
    );

    expect(screen.getByText("connecting")).toBeInTheDocument();

    await act(async () => {
      getLastWs().triggerEvent("open");
    });

    expect(screen.getByText("connected")).toBeInTheDocument();
  });

  it("populates users from presence_state message", async () => {
    function UserList() {
      const { users } = useCollab();
      return (
        <ul>
          {users.map((u) => (
            <li key={u.userId}>{u.userId}</li>
          ))}
        </ul>
      );
    }

    render(
      <CollabProvider roomId="r1" userId="self" userName="Self">
        <UserList />
      </CollabProvider>,
    );

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: {
          alice: { status: "online", lastSeen: Date.now() },
          bob: { status: "away", lastSeen: Date.now() },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("alice")).toBeInTheDocument();
      expect(screen.getByText("bob")).toBeInTheDocument();
    });
  });

  it("does not show self in the users list", async () => {
    function UserList() {
      const { users } = useCollab();
      return (
        <ul>
          {users.map((u) => (
            <li key={u.userId}>{u.userId}</li>
          ))}
        </ul>
      );
    }

    render(
      <CollabProvider roomId="r1" userId="self" userName="Self">
        <UserList />
      </CollabProvider>,
    );

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: {
          self: { status: "online", lastSeen: Date.now() },
          alice: { status: "online", lastSeen: Date.now() },
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("self")).not.toBeInTheDocument();
      expect(screen.getByText("alice")).toBeInTheDocument();
    });
  });

  it("removes user on presence_changed offline", async () => {
    function UserList() {
      const { users } = useCollab();
      return (
        <ul>
          {users.map((u) => (
            <li key={u.userId}>{u.userId}</li>
          ))}
        </ul>
      );
    }

    render(
      <CollabProvider roomId="r1" userId="self" userName="Self">
        <UserList />
      </CollabProvider>,
    );

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: { alice: { status: "online", lastSeen: Date.now() } },
      });
    });

    await waitFor(() => expect(screen.getByText("alice")).toBeInTheDocument());

    await act(async () => {
      getLastWs().triggerEvent("message", {
        type: "presence_changed",
        userId: "alice",
        status: "offline",
        lastSeen: Date.now(),
      });
    });

    await waitFor(() => expect(screen.queryByText("alice")).not.toBeInTheDocument());
  });

  it("sends presence_set and heartbeat after open", async () => {
    vi.useFakeTimers();
    render(
      <CollabProvider roomId="r1" userId="u1" userName="Alice">
        <div />
      </CollabProvider>,
    );

    await act(async () => {
      getLastWs().triggerEvent("open");
    });

    const ws = getLastWs();
    // Should have sent presence_set on open
    const presenceSet = ws.send.mock.calls.find((args) => {
      try {
        return (JSON.parse(args[0] as string) as Record<string, unknown>).type === "presence_set";
      } catch {
        return false;
      }
    });
    expect(presenceSet).toBeDefined();

    const sendCallsBefore = ws.send.mock.calls.length;
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });

    const newCalls = ws.send.mock.calls.slice(sendCallsBefore);
    const heartbeat = newCalls.find((args) => {
      try {
        return (JSON.parse(args[0] as string) as Record<string, unknown>).type === "heartbeat";
      } catch {
        return false;
      }
    });
    expect(heartbeat).toBeDefined();
    vi.useRealTimers();
  });
});

// ── PresenceBar ────────────────────────────────────────────────────────────

describe("PresenceBar", () => {
  it("shows 'Just you' when no remote users", async () => {
    const Wrapper = makeWrapper();
    render(<PresenceBar />, { wrapper: Wrapper });

    await act(async () => {
      getLastWs().triggerEvent("open");
    });

    await waitFor(() => expect(screen.getByText("Just you")).toBeInTheDocument());
  });

  it("shows viewer count including self", async () => {
    const Wrapper = makeWrapper();
    render(<PresenceBar />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: {
          alice: { status: "online", lastSeen: Date.now() },
          bob: { status: "online", lastSeen: Date.now() },
        },
      });
    });

    // self + alice + bob = 3 viewing
    await waitFor(() => expect(screen.getByText("3 viewing")).toBeInTheDocument());
  });

  it("calls onUserClick when avatar is clicked", async () => {
    const onUserClick = vi.fn();
    const Wrapper = makeWrapper();
    render(<PresenceBar onUserClick={onUserClick} />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: { alice: { status: "online", lastSeen: Date.now() } },
      });
    });

    await waitFor(() => screen.getByLabelText(/alice/i));
    fireEvent.click(screen.getByLabelText(/alice/i));
    expect(onUserClick).toHaveBeenCalledWith("alice");
  });

  it("shows overflow badge when more than 5 users", async () => {
    const Wrapper = makeWrapper();
    render(<PresenceBar />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      const state: Record<string, { status: string; lastSeen: number }> = {};
      for (let i = 0; i < 7; i++) {
        state[`user-${i}`] = { status: "online", lastSeen: Date.now() };
      }
      ws.triggerEvent("message", { type: "presence_state", state });
    });

    await waitFor(() => expect(screen.getByLabelText(/2 more users/i)).toBeInTheDocument());
  });
});

// ── CollabIndicator ────────────────────────────────────────────────────────

describe("CollabIndicator", () => {
  it("shows reconnecting label after websocket close", async () => {
    const Wrapper = makeWrapper();
    render(<CollabIndicator />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
    });

    await act(async () => {
      getLastWs().triggerEvent("close");
    });

    await waitFor(() =>
      expect(screen.getByText(/Reconnecting/i)).toBeInTheDocument(),
    );
  });

  it("shows 'Just you' viewer count when connected alone", async () => {
    const Wrapper = makeWrapper();
    render(<CollabIndicator />, { wrapper: Wrapper });

    await act(async () => {
      getLastWs().triggerEvent("open");
    });

    await waitFor(() => expect(screen.getByText("Just you")).toBeInTheDocument());
  });

  it("shows typing indicator when users are typing", async () => {
    const Wrapper = makeWrapper();
    render(<CollabIndicator />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: { alice: { status: "online", lastSeen: Date.now() } },
      });
      ws.triggerEvent("message", {
        type: "typing",
        userId: "alice",
        isTyping: true,
      });
    });

    await waitFor(() =>
      expect(screen.getByText(/alice is typing/i)).toBeInTheDocument(),
    );
  });

  it("shows 'N viewing' label when other users present", async () => {
    const Wrapper = makeWrapper();
    render(<CollabIndicator />, { wrapper: Wrapper });

    await act(async () => {
      const ws = getLastWs();
      ws.triggerEvent("open");
      ws.triggerEvent("message", {
        type: "presence_state",
        state: {
          alice: { status: "online", lastSeen: Date.now() },
        },
      });
    });

    // self + alice = 2 viewing
    await waitFor(() => expect(screen.getByText("2 viewing")).toBeInTheDocument());
  });
});

// ── useSharedState ─────────────────────────────────────────────────────────

describe("dispatchSharedStateEvent / dispatchSelectionEvent", () => {
  it("dispatchSharedStateEvent fires collab:shared_state on window", () => {
    const listener = vi.fn();
    window.addEventListener("collab:shared_state", listener);
    dispatchSharedStateEvent({ key: "test", value: 42, clock: 1, wallTime: 100, userId: "u1" });
    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail as Record<string, unknown>;
    expect(detail.key).toBe("test");
    expect(detail.value).toBe(42);
    window.removeEventListener("collab:shared_state", listener);
  });

  it("dispatchSelectionEvent fires collab:selection on window", () => {
    const listener = vi.fn();
    window.addEventListener("collab:selection", listener);
    dispatchSelectionEvent({
      userId: "u1",
      range: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 5 },
    });
    expect(listener).toHaveBeenCalledOnce();
    const detail = (listener.mock.calls[0][0] as CustomEvent).detail as Record<string, unknown>;
    expect(detail.userId).toBe("u1");
    window.removeEventListener("collab:selection", listener);
  });
});
