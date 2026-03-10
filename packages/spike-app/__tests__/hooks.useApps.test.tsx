import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApp, useApps } from "@/ui/hooks/useApps";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useApps showcase fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps showcase apps visible when the public apps endpoint is unavailable", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockRejectedValueOnce(new Error("mcp unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tools: [
            {
              name: "orchestrator_create_plan",
              description: "Plan multi-step work.",
              category: "Agents & Collaboration",
            },
          ],
        }),
      } as Response);

    const { result } = renderHook(() => useApps(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((app) => app.slug)).toContain("pages-template-chooser");
    expect(result.current.data?.find((app) => app.slug === "pages-template-chooser")?.name).toBe(
      "Pages Template Chooser",
    );
  });

  it("keeps live content apps visible when the public apps endpoint is unavailable", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockRejectedValueOnce(new Error("mcp unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tools: [
            {
              name: "orchestrator_create_plan",
              description: "Plan multi-step work.",
              category: "Agents & Collaboration",
            },
          ],
        }),
      } as Response);

    const { result } = renderHook(() => useApps(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((app) => app.slug)).toContain("qa-studio");
  });

  it("returns showcase app detail without requiring the public app registry", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    } as Response);

    const { result } = renderHook(() => useApp("pages-template-chooser"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.slug).toBe("pages-template-chooser");
    expect(result.current.data?.tool_count).toBe(0);
    expect(result.current.data?.markdown).toContain("# Pages Template Chooser");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns content app detail without requiring the public app registry", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "not found" }),
    } as Response);

    const { result } = renderHook(() => useApp("qa-studio"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.slug).toBe("qa-studio");
    expect(result.current.data?.markdown).toContain("# QA Studio");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
