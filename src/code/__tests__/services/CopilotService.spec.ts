import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Mock tryCatch to pass through
vi.mock("@/lib/try-catch", () => ({
  tryCatch: async (p: Promise<unknown>) => {
    try {
      const data = await p;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  },
}));

describe("CopilotService", () => {
  let copilotService: Awaited<typeof import("@/services/CopilotService")>["copilotService"];

  beforeEach(async () => {
    vi.resetModules();
    localStorageMock.clear();
    vi.stubGlobal("fetch", vi.fn());

    const mod = await import("@/services/CopilotService");
    copilotService = mod.copilotService;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should start with active status when localStorage has no value", () => {
    expect(copilotService.getStatus()).toBe("active");
    expect(copilotService.isEnabled()).toBe(true);
  });

  it("should start disabled when localStorage has false", async () => {
    vi.resetModules();
    localStorageMock.setItem("copilot_enabled", "false");
    const mod = await import("@/services/CopilotService");
    expect(mod.copilotService.getStatus()).toBe("disabled");
    expect(mod.copilotService.isEnabled()).toBe(false);
  });

  it("should toggle from active to disabled", () => {
    const listener = vi.fn();
    copilotService.onStatusChange(listener);

    copilotService.toggle();

    expect(copilotService.getStatus()).toBe("disabled");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("copilot_enabled", "false");
    expect(listener).toHaveBeenCalledWith("disabled");
  });

  it("should toggle from disabled to active", async () => {
    vi.resetModules();
    localStorageMock.setItem("copilot_enabled", "false");
    const mod = await import("@/services/CopilotService");
    const svc = mod.copilotService;

    svc.toggle();

    expect(svc.getStatus()).toBe("active");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("copilot_enabled", "true");
  });

  it("should transition to loading then active on successful completion", async () => {
    const statuses: string[] = [];
    copilotService.onStatusChange((s) => statuses.push(s));

    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ text: "completion result" }] }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const controller = new AbortController();
    const result = await copilotService.requestCompletion("prefix", "suffix", controller.signal);

    expect(result).toBe("completion result");
    expect(statuses).toEqual(["loading", "active"]);
  });

  it("should send correct request format", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({ content: [{ text: "result" }] }),
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as unknown as Response);

    const controller = new AbortController();
    await copilotService.requestCompletion("pre", "suf", controller.signal);

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/anthropic/v1/messages"),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      }),
    );

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0]![1]!.body as string);
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.max_tokens).toBe(256);
    expect(body.messages[0].content).toContain("pre");
    expect(body.messages[0].content).toContain("suf");
  });

  it("should go offline on fetch error", async () => {
    const statuses: string[] = [];
    copilotService.onStatusChange((s) => statuses.push(s));

    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const controller = new AbortController();
    const result = await copilotService.requestCompletion("pre", "suf", controller.signal);

    expect(result).toBeNull();
    expect(statuses).toContain("offline");
  });

  it("should go offline on non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const controller = new AbortController();
    const result = await copilotService.requestCompletion("pre", "suf", controller.signal);

    expect(result).toBeNull();
    expect(copilotService.getStatus()).toBe("offline");
  });

  it("should return null during cooldown period", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("fail"));
    const controller = new AbortController();

    await copilotService.requestCompletion("a", "b", controller.signal);
    expect(copilotService.getStatus()).toBe("offline");

    // Second request within cooldown should return null immediately
    const result = await copilotService.requestCompletion("c", "d", controller.signal);
    expect(result).toBeNull();
  });

  it("should return active on aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();

    vi.mocked(fetch).mockRejectedValue(new DOMException("Aborted", "AbortError"));

    const result = await copilotService.requestCompletion("pre", "suf", controller.signal);

    expect(result).toBeNull();
    expect(copilotService.getStatus()).toBe("active");
  });

  it("should return null when disabled", async () => {
    copilotService.toggle(); // disable
    const controller = new AbortController();
    const result = await copilotService.requestCompletion("pre", "suf", controller.signal);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should support unsubscribing from status changes", () => {
    const listener = vi.fn();
    const unsub = copilotService.onStatusChange(listener);

    copilotService.toggle(); // active -> disabled
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    copilotService.toggle(); // disabled -> active
    expect(listener).toHaveBeenCalledTimes(1); // no additional calls
  });
});
