import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Use vi.hoisted so mock fn is available inside vi.mock factory
const { mockSessionProvider } = vi.hoisted(() => ({
  mockSessionProvider: vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>),
}));

vi.mock("@/lib/auth/client", () => ({
  SessionProvider: mockSessionProvider,
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  authClient: {},
}));

import { SessionProvider } from "./provider";
import { UserRole } from "../core/types";
import type { AuthSession } from "../core/types";

describe("SessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set implementation after clearAllMocks
    mockSessionProvider.mockImplementation(({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ));
  });

  it("renders children", () => {
    render(
      <SessionProvider>
        <div data-testid="child">Hello</div>
      </SessionProvider>,
    );
    expect(screen.getByTestId("child")).toBeTruthy();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("passes session prop to underlying SessionProvider", () => {
    const fakeSession: AuthSession = {
      user: {
        id: "user_abc",
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: UserRole.USER,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };

    render(
      <SessionProvider session={fakeSession}>
        <span>content</span>
      </SessionProvider>,
    );

    const calls = mockSessionProvider.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const props = calls[calls.length - 1]![0] as {
      children: React.ReactNode;
      session?: AuthSession | null;
    };
    expect(props.session).toEqual(fakeSession);
  });

  it("passes null session to underlying SessionProvider", () => {
    render(
      <SessionProvider session={null}>
        <span>no session</span>
      </SessionProvider>,
    );

    const calls = mockSessionProvider.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const props = calls[calls.length - 1]![0] as {
      children: React.ReactNode;
      session?: AuthSession | null;
    };
    expect(props.session).toBeNull();
  });

  it("passes undefined session when no session prop given", () => {
    render(
      <SessionProvider>
        <span>no session prop</span>
      </SessionProvider>,
    );

    const calls = mockSessionProvider.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const props = calls[calls.length - 1]![0] as {
      children: React.ReactNode;
      session?: AuthSession | null;
    };
    expect(props.session).toBeUndefined();
  });

  it("delegates to underlying SessionProvider once per render", () => {
    render(
      <SessionProvider>
        <div>wrapped</div>
      </SessionProvider>,
    );
    expect(mockSessionProvider).toHaveBeenCalledTimes(1);
  });
});
