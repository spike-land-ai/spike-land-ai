import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("usePricing", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns USD defaults initially and starts loading", async () => {
    // Mock a slow response
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { usePricing } = await import("../usePricing");
    const { result } = renderHook(() => usePricing());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data.currency).toBe("USD");
    expect(result.current.data.pro.monthly).toBe("$29");
  });

  it("updates pricing data after successful fetch", async () => {
    const mockData = {
      currency: "EUR",
      billedInUsd: true,
      pro: {
        monthlyFormatted: "€29",
        annualFormatted: "€23",
        annualTotalFormatted: "€276/yr",
      },
      business: {
        monthlyFormatted: "€99",
        annualFormatted: "€79",
        annualTotalFormatted: "€948/yr",
      },
      credits: {
        starter: { formatted: "€5" },
        popular: { formatted: "€20" },
        power: { formatted: "€50" },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { usePricing } = await import("../usePricing");
    const { result } = renderHook(() => usePricing());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.currency).toBe("EUR");
    expect(result.current.data.billedInUsd).toBe(true);
    expect(result.current.data.pro.monthly).toBe("€29");
    expect(result.current.data.business.annualTotal).toBe("€948/yr");
    expect(result.current.data.credits.power).toBe("€50");
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("stays on USD defaults if fetch fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    });

    const { usePricing } = await import("../usePricing");
    const { result } = renderHook(() => usePricing());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.currency).toBe("USD");
    expect(result.current.data.pro.monthly).toBe("$29");
  });

  it("stays on USD defaults if fetch throws error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const { usePricing } = await import("../usePricing");
    const { result } = renderHook(() => usePricing());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data.currency).toBe("USD");
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("Network error");
  });

  it("uses cached data on subsequent hook calls", async () => {
    const mockData = {
      currency: "GBP",
      billedInUsd: false,
      pro: {
        monthlyFormatted: "£29",
        annualFormatted: "£23",
        annualTotalFormatted: "£276/yr",
      },
      business: {
        monthlyFormatted: "£99",
        annualFormatted: "£79",
        annualTotalFormatted: "£948/yr",
      },
      credits: {
        starter: { formatted: "£5" },
        popular: { formatted: "£20" },
        power: { formatted: "£50" },
      },
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const { usePricing } = await import("../usePricing");

    // First call to fetch data
    const { result: result1, unmount: unmount1 } = renderHook(() => usePricing());
    await waitFor(() => expect(result1.current.isLoading).toBe(false));
    expect(result1.current.data.currency).toBe("GBP");
    unmount1();

    // Second call should use cache and not be loading
    const { result: result2 } = renderHook(() => usePricing());
    expect(result2.current.isLoading).toBe(false);
    expect(result2.current.data.currency).toBe("GBP");

    // Should only have fetched once
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
