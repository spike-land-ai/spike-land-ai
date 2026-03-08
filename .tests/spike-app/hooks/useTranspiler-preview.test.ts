import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let useTranspiler: typeof import("../../../src/frontend/platform-frontend/ui/hooks/useTranspiler").useTranspiler;
const fetchMock = vi.fn<typeof fetch>();

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);

  const mod = await import("../../../src/frontend/platform-frontend/ui/hooks/useTranspiler");
  useTranspiler = mod.useTranspiler;
});

describe("useTranspiler preview shell", () => {
  it("injects first-party preview imports and semantic theme tokens into preview HTML", async () => {
    fetchMock.mockResolvedValue(
      new Response('const App = () => "hello";export default App;', { status: 200 }),
    );

    const { result } = renderHook(() =>
      useTranspiler('export default function App() { return "hi"; }', 10, false),
    );

    await waitFor(() => {
      expect(result.current.isTranspiling).toBe(false);
      expect(result.current.html).toBeTruthy();
    });

    expect(result.current.html).toContain("https://js.spike.land/react@19.2.4?bundle");
    expect(result.current.html).not.toContain("fonts.googleapis.com");
    expect(result.current.html).toContain("@theme inline");
    expect(result.current.html).toContain('data-theme="light"');
  });

  it("rebuilds preview HTML on dark mode changes without re-fetching code", async () => {
    fetchMock.mockResolvedValue(
      new Response('const App = () => "hello";export default App;', { status: 200 }),
    );

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
