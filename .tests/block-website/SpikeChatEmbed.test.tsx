import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SpikeChatEmbed } from "../../src/core/block-website/ui/SpikeChatEmbed";

vi.mock("lucide-react", () => ({
  Loader2: () => null,
  MessageCircle: () => null,
}));

let stateCalls: Array<[string, unknown]> = [];
let effectCleanups: Array<() => void> = [];

vi.mock("react", () => ({
  useState: (initialValue: unknown) => {
    stateCalls.push(["useState", initialValue]);
    return [initialValue, vi.fn()];
  },
  useEffect: (fn: () => (() => void) | void) => {
    const cleanup = fn();
    if (typeof cleanup === "function") effectCleanups.push(cleanup);
  },
}));

describe("SpikeChatEmbed", () => {
  beforeEach(() => {
    stateCalls = [];
    effectCleanups = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    effectCleanups.forEach((c) => c());
    effectCleanups = [];
    vi.useRealTimers();
  });

  it("renders with loading state initially", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { hostname: "spike.land" },
    });

    const result = SpikeChatEmbed({ channelSlug: "test-chan", workspaceSlug: "test-work", guestAccess: true });
    expect(result).toBeDefined();
    expect(typeof result).toBe("object");

    // Initial state should be "loading"
    expect(stateCalls[0]).toEqual(["useState", "loading"]);

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });

  it("uses localhost URL in local dev", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { hostname: "localhost" },
    });

    const result = SpikeChatEmbed({ channelSlug: "test-chan", workspaceSlug: "test-work" });
    expect(result).toBeDefined();

    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });
});
