import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAppSession } from "@/ui/hooks/useAppSession";

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
});

describe("useAppSession", () => {
  const slug = "test-app";
  const sessionKey = `mcp-session-${slug}`;
  const graph = {
    "tool-1": {
      always_available: true,
      outputs: { "output-1": "string" },
    },
    "tool-2": {
      inputs: { "input-1": "from:tool-1.output-1" },
      outputs: { "output-2": "number" },
    },
  };
  const tools = ["tool-1", "tool-2"];

  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("initializes with default state when sessionStorage is empty", () => {
    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    expect(result.current.session).toEqual({
      appSlug: slug,
      outputs: {},
      history: [],
      availableTools: ["tool-1"], // tool-2 is not available because it depends on tool-1 output
    });
  });

  it("initializes from sessionStorage if available", () => {
    const storedSession = {
      appSlug: slug,
      outputs: { "tool-1.output-1": "value1" },
      history: [{ tool: "tool-1", input: {}, result: { "output-1": "value1" }, timestamp: 123 }],
      availableTools: ["tool-1", "tool-2"],
    };
    sessionStorageMock.setItem(sessionKey, JSON.stringify(storedSession));

    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    expect(result.current.session.outputs).toEqual(storedSession.outputs);
    expect(result.current.session.history).toEqual(storedSession.history);
  });

  it("handles corrupted sessionStorage data", () => {
    sessionStorageMock.setItem(sessionKey, "invalid-json");
    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    expect(result.current.session.appSlug).toBe(slug);
    expect(console.error).toHaveBeenCalled();
  });

  it("persists session to sessionStorage on changes", () => {
    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    act(() => {
      result.current.recordToolResult("tool-1", { foo: "bar" }, { "output-1": "new-value" });
    });

    expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
      sessionKey,
      expect.stringContaining("new-value"),
    );
  });

  it("recordToolResult updates outputs and history", () => {
    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    act(() => {
      result.current.recordToolResult("tool-1", { param: "val" }, { "output-1": "result-val" });
    });

    expect(result.current.session.outputs).toEqual({
      "tool-1.output-1": "result-val",
    });
    expect(result.current.session.history).toHaveLength(1);
    expect(result.current.session.history[0].tool).toBe("tool-1");
    expect(result.current.session.history[0].input).toEqual({ param: "val" });
    expect(result.current.session.history[0].result).toEqual({ "output-1": "result-val" });
  });

  it("recordToolResult handles result as a string", () => {
    const stringGraph = {
      "text-tool": {
        outputs: { text: "string" },
      },
    };
    const { result } = renderHook(() => useAppSession(slug, stringGraph, ["text-tool"]));

    act(() => {
      result.current.recordToolResult("text-tool", {}, "hello world");
    });

    expect(result.current.session.outputs).toEqual({
      "text-tool.text": "hello world",
    });
  });

  it("recordToolResult handles result with content text blocks containing JSON", () => {
    const jsonGraph = {
      "json-tool": {
        outputs: { data: "string" },
      },
    };
    const { result } = renderHook(() => useAppSession(slug, jsonGraph, ["json-tool"]));

    act(() => {
      result.current.recordToolResult("json-tool", {}, {
        content: [{ type: "text", text: JSON.stringify({ data: "extracted-data" }) }],
      });
    });

    expect(result.current.session.outputs).toEqual({
      "json-tool.data": "extracted-data",
    });
  });

  it("warns when JSON parsing fails in content text block", () => {
    const jsonGraph = {
      "json-tool": {
        outputs: { data: "string" },
      },
    };
    const { result } = renderHook(() => useAppSession(slug, jsonGraph, ["json-tool"]));

    act(() => {
      result.current.recordToolResult("json-tool", {}, {
        content: [{ type: "text", text: "invalid-json" }],
      });
    });

    expect(console.warn).toHaveBeenCalled();
    expect(result.current.session.outputs).toEqual({});
  });

  it("updates available tools with multiple dependencies", () => {
    const multiGraph = {
      "tool-a": { always_available: true, outputs: { out: "s" } },
      "tool-b": { always_available: true, outputs: { out: "s" } },
      "tool-c": {
        inputs: {
          i1: "from:tool-a.out",
          i2: "from:tool-b.out",
        },
      },
    };
    const { result } = renderHook(() => useAppSession(slug, multiGraph, ["tool-a", "tool-b", "tool-c"]));

    expect(result.current.isToolAvailable("tool-c")).toBe(false);

    act(() => {
      result.current.recordToolResult("tool-a", {}, { out: "val-a" });
    });
    expect(result.current.isToolAvailable("tool-c")).toBe(false);

    act(() => {
      result.current.recordToolResult("tool-b", {}, { out: "val-b" });
    });
    expect(result.current.isToolAvailable("tool-c")).toBe(true);
  });

  it("resetSession clears outputs and history but keeps slug", () => {
    const { result } = renderHook(() => useAppSession(slug, graph, tools));

    act(() => {
      result.current.recordToolResult("tool-1", {}, { "output-1": "val" });
    });

    expect(result.current.session.outputs).not.toEqual({});

    act(() => {
      result.current.resetSession();
    });

    expect(result.current.session.appSlug).toBe(slug);
    expect(result.current.session.outputs).toEqual({});
    expect(result.current.session.history).toEqual([]);
    expect(result.current.session.availableTools).toEqual(["tool-1"]);
  });

  it("handles tools not in graph as always available", () => {
    const { result } = renderHook(() => useAppSession(slug, {}, ["unknown-tool"]));
    expect(result.current.isToolAvailable("unknown-tool")).toBe(true);
  });
});
