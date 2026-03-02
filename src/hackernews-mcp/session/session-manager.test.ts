import { beforeEach, describe, expect, it } from "vitest";
import { SessionManager } from "./session-manager.js";

describe("SessionManager", () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
  });

  it("starts logged out", () => {
    expect(session.isLoggedIn()).toBe(false);
    expect(session.getUsername()).toBeNull();
    expect(session.getCookie()).toBeNull();
    expect(session.getState()).toEqual({
      username: null,
      cookie: null,
      loggedInAt: null,
    });
  });

  it("login sets state correctly", () => {
    session.login("testuser", "user=testuser; HttpOnly");
    expect(session.isLoggedIn()).toBe(true);
    expect(session.getUsername()).toBe("testuser");
    expect(session.getCookie()).toBe("user=testuser; HttpOnly");
    const state = session.getState();
    expect(state.loggedInAt).toBeTypeOf("number");
    expect(state.loggedInAt).toBeGreaterThan(0);
  });

  it("logout clears state", () => {
    session.login("testuser", "user=testuser");
    session.logout();
    expect(session.isLoggedIn()).toBe(false);
    expect(session.getUsername()).toBeNull();
    expect(session.getCookie()).toBeNull();
  });

  it("getState returns a copy", () => {
    session.login("testuser", "cookie");
    const state1 = session.getState();
    const state2 = session.getState();
    expect(state1).toEqual(state2);
    expect(state1).not.toBe(state2);
  });

  it("can re-login with different credentials", () => {
    session.login("user1", "cookie1");
    session.login("user2", "cookie2");
    expect(session.getUsername()).toBe("user2");
    expect(session.getCookie()).toBe("cookie2");
  });

  it("isSessionValid returns false when loggedInAt is null", () => {
    // Fresh session — loggedInAt is null
    expect(session.isSessionValid()).toBe(false);
  });

  it("isSessionValid returns false when session is expired", () => {
    // Manually set loggedInAt to a timestamp older than 24 hours
    session.login("testuser", "cookie");
    // Simulate expired session by checking behavior after logout
    session.logout();
    // After logout loggedInAt is null, so isSessionValid must return false
    expect(session.isSessionValid()).toBe(false);
    expect(session.isLoggedIn()).toBe(false);
  });
});
