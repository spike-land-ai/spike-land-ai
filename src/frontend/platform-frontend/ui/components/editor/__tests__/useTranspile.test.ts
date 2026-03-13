import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTranspile, buildPreviewHtml } from "../useTranspile";

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// buildPreviewHtml unit tests
// ---------------------------------------------------------------------------

describe("buildPreviewHtml", () => {
  it("includes the transpiled code in the output", () => {
    const html = buildPreviewHtml("const x = 1;", false);
    expect(html).toContain("const x = 1;");
  });

  it("sets dark theme class when isDarkMode is true", () => {
    const html = buildPreviewHtml("", true);
    expect(html).toContain('data-theme="dark"');
  });

  it("sets light theme class when isDarkMode is false", () => {
    const html = buildPreviewHtml("", false);
    expect(html).toContain('data-theme="light"');
  });

  it("strips export default function and keeps function name", () => {
    const html = buildPreviewHtml("export default function MyComp() {}", false);
    expect(html).toContain("function MyComp()");
    expect(html).not.toContain("export default function");
  });

  it("replaces anonymous export default with const App", () => {
    const html = buildPreviewHtml("export default () => <div/>", false);
    expect(html).toContain("const App =");
  });
});

// ---------------------------------------------------------------------------
// useTranspile hook tests
// ---------------------------------------------------------------------------

describe("useTranspile", () => {
  it("starts with no output and isTranspiling=false", () => {
    const { result } = renderHook(() => useTranspile("", { debounceMs: 100 }));
    expect(result.current.html).toBeNull();
    expect(result.current.isTranspiling).toBe(false);
  });

  it("sets isTranspiling=true while debouncing non-empty source", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("const x=1;") });
    const { result } = renderHook(() => useTranspile("const a = 1;", { debounceMs: 200 }));

    // After first render, transpiling should be true because timeout hasn't fired
    expect(result.current.isTranspiling).toBe(true);
  });

  it("produces html after debounce fires and fetch resolves", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("const x=1;") });
    const { result } = renderHook(() => useTranspile("const a=1;", { debounceMs: 100 }));

    act(() => { vi.advanceTimersByTime(150); });

    await waitFor(() => {
      expect(result.current.html).not.toBeNull();
    });

    expect(result.current.isTranspiling).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error when fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("SyntaxError: unexpected token") });
    const { result } = renderHook(() => useTranspile("const;", { debounceMs: 100 }));

    act(() => { vi.advanceTimersByTime(150); });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.html).toBeNull();
  });

  it("clearError resets the error state", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("bad code") });
    const { result } = renderHook(() => useTranspile("x;", { debounceMs: 100 }));

    act(() => { vi.advanceTimersByTime(150); });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => { result.current.clearError(); });
    expect(result.current.error).toBeNull();
  });

  it("resets state when source becomes empty", () => {
    const { result, rerender } = renderHook(
      ({ src }: { src: string }) => useTranspile(src, { debounceMs: 100 }),
      { initialProps: { src: "const x=1;" } },
    );

    rerender({ src: "" });
    expect(result.current.html).toBeNull();
    expect(result.current.isTranspiling).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
