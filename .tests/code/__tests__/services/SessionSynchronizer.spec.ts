import { describe, expect, it, vi, _beforeEach, afterEach } from "vitest";
import { SessionSynchronizer } from "@/services/SessionSynchronizer";
import type { ICodeSession } from "@/lib/interfaces";

const makeSession = (overrides: Partial<ICodeSession> = {}): ICodeSession => ({
  codeSpace: "test-space",
  code: "const x = 1;",
  html: "<div>hello</div>",
  css: "body {}",
  transpiled: "",
  ...overrides,
});

describe("SessionSynchronizer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("creates without initial session", () => {
      const ss = new SessionSynchronizer("my-space");
      expect(ss.getSession()).toBeNull();
    });

    it("creates with initial session", () => {
      const session = makeSession();
      const ss = new SessionSynchronizer("test-space", session);
      const s = ss.getSession();
      expect(s).not.toBeNull();
      expect(s!.code).toBe(session.code);
    });
  });

  describe("getSession", () => {
    it("returns null when no session set", () => {
      const ss = new SessionSynchronizer("space");
      expect(ss.getSession()).toBeNull();
    });

    it("returns current session after init", async () => {
      const ss = new SessionSynchronizer("space", makeSession());
      expect(ss.getSession()).not.toBeNull();
    });
  });

  describe("init", () => {
    it("sets session when passed directly", async () => {
      const ss = new SessionSynchronizer("space");
      const session = makeSession({ code: "let y = 2;" });
      const result = await ss.init(session);
      expect(result.code).toBe("let y = 2;");
      expect(ss.getSession()!.code).toBe("let y = 2;");
    });

    it("returns existing session when already set (no args)", async () => {
      const session = makeSession({ code: "existing" });
      const ss = new SessionSynchronizer("space", session);
      const result = await ss.init();
      expect(result.code).toBe("existing");
    });

    it("fetches from /live/:codeSpace/session.json when session is absent", async () => {
      const mockData = makeSession({ code: "fetched code" });
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });
      vi.stubGlobal("fetch", mockFetch);

      const ss = new SessionSynchronizer("space");
      const result = await ss.init();
      expect(mockFetch).toHaveBeenCalledWith("/live/space/session.json");
      expect(result.code).toBe("fetched code");
    });

    it("falls back to empty session when fetch fails", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });
      vi.stubGlobal("fetch", mockFetch);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const ss = new SessionSynchronizer("space");
      const result = await ss.init();
      expect(result.code).toBe("");
      expect(consoleSpy).toHaveBeenCalled();
    });

    it("falls back to empty session when fetch throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
      vi.stubGlobal("fetch", mockFetch);
      vi.spyOn(console, "error").mockImplementation(() => {});

      const ss = new SessionSynchronizer("space");
      const result = await ss.init();
      expect(result.code).toBe("");
    });
  });

  describe("getCode", () => {
    it("returns code from existing session", async () => {
      const ss = new SessionSynchronizer("space", makeSession({ code: "existing code" }));
      const code = await ss.getCode();
      expect(code).toBe("existing code");
    });

    it("fetches session and returns code when no session set", async () => {
      const mockData = makeSession({ code: "fetched!" });
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockData),
        }),
      );
      const ss = new SessionSynchronizer("space");
      const code = await ss.getCode();
      expect(code).toBe("fetched!");
    });
  });

  describe("subscribe / unsubscribe", () => {
    it("registers callback and returns unsubscribe fn", () => {
      const ss = new SessionSynchronizer("space", makeSession());
      const cb = vi.fn();
      const unsub = ss.subscribe(cb);
      expect(typeof unsub).toBe("function");
    });

    it("notifies subscriber when broadcastSession is called", () => {
      const session = makeSession({ code: "v1" });
      const ss = new SessionSynchronizer("space", session);
      const cb = vi.fn();
      ss.subscribe(cb);
      const newSession = { ...makeSession({ code: "v2" }), sender: "user" };
      ss.broadcastSession(newSession);
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ code: "v2" }));
    });

    it("unsubscribes correctly — no longer called after unsubscribe", () => {
      const session = makeSession({ code: "v1" });
      const ss = new SessionSynchronizer("space", session);
      const cb = vi.fn();
      const unsub = ss.subscribe(cb);
      unsub();
      ss.broadcastSession({ ...makeSession({ code: "v2" }), sender: "user" });
      expect(cb).not.toHaveBeenCalled();
    });

    it("subscriber error is caught and does not throw", () => {
      const session = makeSession({ code: "v1" });
      const ss = new SessionSynchronizer("space", session);
      vi.spyOn(console, "error").mockImplementation(() => {});
      ss.subscribe(() => {
        throw new Error("subscriber boom");
      });
      expect(() => {
        ss.broadcastSession({ ...makeSession({ code: "v2" }), sender: "user" });
      }).not.toThrow();
    });
  });

  describe("broadcastSession", () => {
    it("sets session and notifies when current session is null", () => {
      const ss = new SessionSynchronizer("space");
      const cb = vi.fn();
      ss.subscribe(cb);
      const newSession = { ...makeSession({ code: "first" }), sender: "user" };
      ss.broadcastSession(newSession);
      expect(ss.getSession()!.code).toBe("first");
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it("skips notification when session hash unchanged", () => {
      // Use a session with explicit transpiled to avoid sanitizeSession defaulting it
      const session = makeSession({ code: "same", transpiled: "export default () => null;" });
      const ss = new SessionSynchronizer("space", session);
      // After construction, session is sanitized internally; get actual stored session
      const storedSession = ss.getSession()!;
      const cb = vi.fn();
      ss.subscribe(cb);
      // Broadcast the exact stored session — hash should be equal, no notification
      ss.broadcastSession({ ...storedSession, sender: "user" });
      expect(cb).not.toHaveBeenCalled();
    });

    it("updates session and notifies when session hash changes", () => {
      const session = makeSession({ code: "v1" });
      const ss = new SessionSynchronizer("space", session);
      const cb = vi.fn();
      ss.subscribe(cb);
      ss.broadcastSession({ ...makeSession({ code: "v2" }), sender: "user" });
      expect(ss.getSession()!.code).toBe("v2");
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });

  describe("close", () => {
    it("clears subscribers", () => {
      const session = makeSession({ code: "v1" });
      const ss = new SessionSynchronizer("space", session);
      const cb = vi.fn();
      ss.subscribe(cb);
      ss.close();
      ss.broadcastSession({ ...makeSession({ code: "v2" }), sender: "user" });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
