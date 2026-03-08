// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

let useTranspiler: typeof import("../useTranspiler").useTranspiler;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  const mod = await import("../useTranspiler");
  useTranspiler = mod.useTranspiler;
});

describe("useTranspiler", () => {
  it("returns null html for empty source", () => {
    const { result } = renderHook(() => useTranspiler("", 50));
    expect(result.current.html).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isTranspiling).toBe(false);
  });

  it("returns null html for whitespace-only source", () => {
    const { result } = renderHook(() => useTranspiler("   \n  ", 50));
    expect(result.current.html).toBeNull();
    expect(result.current.isTranspiling).toBe(false);
  });

  it("transpiles valid TSX to preview HTML", async () => {
    fetchMock.mockResolvedValue(
      new Response('const App = () => "hello";export default App;', { status: 200 }),
    );

    const { result } = renderHook(() =>
      useTranspiler('export default function App() { return "hi"; }', 10),
    );

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
      expect(result.current.html).toBeTruthy();
    });

    expect(result.current.html).toContain("<!DOCTYPE html>");
    expect(result.current.html).toContain("createRoot");
    expect(result.current.html).toContain("family=Rubik");
    expect(result.current.html).toContain("@theme inline");
    expect(result.current.html).toContain("globalThis.process ??= { env: {} };");
    expect(result.current.error).toBeNull();
  });

  it("shows isTranspiling during debounce", () => {
    fetchMock.mockResolvedValue(new Response("const x = 1;", { status: 200 }));

    const { result } = renderHook(() => useTranspiler("const x = 1;", 5000));

    // Should be transpiling while debounce is pending
    expect(result.current.isTranspiling).toBe(true);
  });

  it("handles transpilation errors gracefully", async () => {
    fetchMock.mockRejectedValue(new Error("Syntax error in source"));

    const { result } = renderHook(() => useTranspiler("invalid {{{", 10));

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
    });

    expect(result.current.error).toBe("Transpiler failed: Syntax error in source");
    expect(result.current.html).toBeNull();
  });

  it("handles non-200 transpiler responses with error message", async () => {
    fetchMock.mockResolvedValue(new Response("Module not found", { status: 500 }));

    const { result } = renderHook(() => useTranspiler("const x = 1;", 10));

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
    });

    expect(result.current.error).toBe("Transpiler failed: Module not found");
  });

  it("clears html when source becomes empty", async () => {
    fetchMock.mockResolvedValue(new Response('const App = () => "hello";', { status: 200 }));

    const { result, rerender } = renderHook(
      ({ source }: { source: string }) => useTranspiler(source, 10),
      { initialProps: { source: "const x = 1;" } },
    );

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
      expect(result.current.html).toBeTruthy();
    });

    rerender({ source: "" });

    expect(result.current.html).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isTranspiling).toBe(false);
  });

  it("debounces rapid code changes", async () => {
    fetchMock.mockResolvedValue(new Response("const x = 1;", { status: 200 }));

    const { rerender } = renderHook(({ source }: { source: string }) => useTranspiler(source, 50), {
      initialProps: { source: "v1" },
    });

    // Rapid changes — each should cancel the previous debounce
    rerender({ source: "v2" });
    rerender({ source: "v3" });
    rerender({ source: "v4" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Only the last value should have been transpiled
    expect(fetchMock.mock.calls[0]![0]).toBe("https://js.spike.land");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: "v4",
      headers: {
        "Content-Type": "text/plain",
        TR_ORIGIN: "http://localhost:3000",
      },
    });
  });

  it("rebuilds preview HTML for dark mode without re-fetching source", async () => {
    fetchMock.mockResolvedValue(new Response('const App = () => "hello";export default App;', { status: 200 }));

    const { result, rerender } = renderHook(
      ({ isDark }: { isDark: boolean }) =>
        useTranspiler('export default function App() { return "hi"; }', 10, isDark),
      { initialProps: { isDark: false } },
    );

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
      expect(result.current.html).toContain('data-theme="light"');
    });

    rerender({ isDark: true });

    await waitFor(() => {
      expect(result.current.html).toContain('data-theme="dark"');
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
