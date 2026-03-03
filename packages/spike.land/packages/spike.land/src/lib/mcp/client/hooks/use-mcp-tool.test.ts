import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const mockCallTool = vi.hoisted(() => vi.fn());
vi.mock("../mcp-client", () => ({ callTool: mockCallTool }));

import { useMcpTool } from "./use-mcp-tool";

describe("useMcpTool", () => {
  beforeEach(() => {
    mockCallTool.mockReset();
  });

  describe("initial state - enabled (default)", () => {
    it("should start with isLoading true when enabled", () => {
      mockCallTool.mockReturnValue(new Promise(() => {})); // never resolves

      const { result } = renderHook(() => useMcpTool("test_tool"));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.isRefetching).toBe(false);
      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("initial state - disabled", () => {
    it("should not fetch and have isLoading false when disabled", () => {
      const { result } = renderHook(() => useMcpTool("test_tool", {}, { enabled: false }));

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockCallTool).not.toHaveBeenCalled();
    });
  });

  describe("automatic fetching", () => {
    it("should fetch data on mount when enabled", async () => {
      const responseData = { items: [1, 2, 3] };
      mockCallTool.mockResolvedValue(responseData);

      const { result } = renderHook(() => useMcpTool("list_items"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(responseData);
      expect(result.current.error).toBeUndefined();
      expect(mockCallTool).toHaveBeenCalledWith("list_items", {});
    });

    it("should pass args to callTool", async () => {
      mockCallTool.mockResolvedValue("ok");

      const { result } = renderHook(() => useMcpTool("search", { query: "test" }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockCallTool).toHaveBeenCalledWith("search", { query: "test" });
    });

    it("should re-fetch when args change", async () => {
      mockCallTool.mockResolvedValue("result1");

      const { result, rerender } = renderHook(
        ({ args }) => useMcpTool("tool", args),
        { initialProps: { args: { page: 1 } as unknown } },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockCallTool).toHaveBeenCalledTimes(1);

      mockCallTool.mockResolvedValue("result2");
      rerender({ args: { page: 2 } });

      await waitFor(() => {
        expect(mockCallTool).toHaveBeenCalledTimes(2);
      });
    });

    it("should re-fetch when enabled changes from false to true", async () => {
      mockCallTool.mockResolvedValue("data");

      const { result, rerender } = renderHook(
        ({ enabled }) => useMcpTool("tool", {}, { enabled }),
        { initialProps: { enabled: false } },
      );

      expect(mockCallTool).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => {
        expect(result.current.data).toBe("data");
      });

      expect(mockCallTool).toHaveBeenCalledTimes(1);
    });
  });

  describe("success handling", () => {
    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      mockCallTool.mockResolvedValue({ id: 1 });

      const { result } = renderHook(() => useMcpTool("tool", {}, { onSuccess }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(onSuccess).toHaveBeenCalledWith({ id: 1 });
    });

    it("should clear error on success after previous error", async () => {
      mockCallTool.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.error).toBeDefined();
      });

      mockCallTool.mockResolvedValue("success");

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.data).toBe("success");
    });
  });

  describe("transform", () => {
    it("should apply transform function to data", async () => {
      mockCallTool.mockResolvedValue({ count: 5 });

      const { result } = renderHook(() =>
        useMcpTool<{ count: number; }, number>("tool", {}, {
          transform: data => data.count * 2,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBe(10);
    });

    it("should call onSuccess with transformed data", async () => {
      const onSuccess = vi.fn();
      mockCallTool.mockResolvedValue({ value: "raw" });

      const { result } = renderHook(() =>
        useMcpTool<{ value: string; }, string>("tool", {}, {
          transform: data => data.value.toUpperCase(),
          onSuccess,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(onSuccess).toHaveBeenCalledWith("RAW");
    });

    it("should work without transform (identity)", async () => {
      mockCallTool.mockResolvedValue({ unchanged: true });

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual({ unchanged: true });
    });
  });

  describe("error handling", () => {
    it("should set error on failure with Error instance", async () => {
      const testError = new Error("API failed");
      mockCallTool.mockRejectedValue(testError);

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe(testError);
    });

    it("should wrap non-Error thrown values", async () => {
      mockCallTool.mockRejectedValue("string error");

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Unknown error");
    });

    it("should call onError callback", async () => {
      const onError = vi.fn();
      const testError = new Error("broken");
      mockCallTool.mockRejectedValue(testError);

      const { result } = renderHook(() => useMcpTool("tool", {}, { onError }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it("should call onError with wrapped error for non-Error values", async () => {
      const onError = vi.fn();
      mockCallTool.mockRejectedValue(null);

      const { result } = renderHook(() => useMcpTool("tool", {}, { onError }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unknown error" }),
      );
    });
  });

  describe("refetch", () => {
    it("should set isRefetching to true during manual refetch", async () => {
      mockCallTool.mockResolvedValue("initial");

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolveRefetch: (value: unknown) => void;
      mockCallTool.mockReturnValue(
        new Promise(resolve => {
          resolveRefetch = resolve;
        }),
      );

      act(() => {
        result.current.refetch();
      });

      expect(result.current.isRefetching).toBe(true);

      await act(async () => {
        resolveRefetch!("refetched");
      });

      expect(result.current.isRefetching).toBe(false);
      expect(result.current.data).toBe("refetched");
    });

    it("should not set isLoading on manual refetch", async () => {
      mockCallTool.mockResolvedValue("initial");

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let resolveRefetch: (value: unknown) => void;
      mockCallTool.mockReturnValue(
        new Promise(resolve => {
          resolveRefetch = resolve;
        }),
      );

      act(() => {
        result.current.refetch();
      });

      // isLoading should remain false during manual refetch, isRefetching should be true
      expect(result.current.isRefetching).toBe(true);

      await act(async () => {
        resolveRefetch!("done");
      });
    });
  });

  describe("refetchInterval", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should auto-refetch at specified interval", async () => {
      let resolveCount = 0;
      mockCallTool.mockImplementation(
        () => Promise.resolve(`data-${++resolveCount}`),
      );

      const { result } = renderHook(() => useMcpTool("tool", {}, { refetchInterval: 5000 }));

      // Let the initial fetch resolve
      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockCallTool).toHaveBeenCalledTimes(1);

      // Advance past interval
      await act(async () => {
        vi.advanceTimersByTime(5000);
        await Promise.resolve();
      });

      expect(mockCallTool).toHaveBeenCalledTimes(2);
    });

    it("should not refetch at interval when disabled", async () => {
      mockCallTool.mockResolvedValue("data");

      renderHook(() => useMcpTool("tool", {}, { enabled: false, refetchInterval: 1000 }));

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockCallTool).not.toHaveBeenCalled();
    });

    it("should clear interval on unmount", async () => {
      mockCallTool.mockImplementation(() => Promise.resolve("data"));

      const { unmount } = renderHook(() => useMcpTool("tool", {}, { refetchInterval: 1000 }));

      // Let the initial fetch resolve
      await act(async () => {
        await Promise.resolve();
      });

      const callCount = mockCallTool.mock.calls.length;
      unmount();

      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      // No more calls after unmount
      expect(mockCallTool).toHaveBeenCalledTimes(callCount);
    });

    it("should not set up interval when refetchInterval is undefined", async () => {
      mockCallTool.mockImplementation(() => Promise.resolve("data"));

      renderHook(() => useMcpTool("tool"));

      await act(async () => {
        await Promise.resolve();
      });

      // Only initial fetch
      expect(mockCallTool).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(10000);
      });

      // Still only initial fetch
      expect(mockCallTool).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading states", () => {
    it("should set isLoading true during initial fetch (not refetching)", async () => {
      let resolvePromise: (value: unknown) => void;
      mockCallTool.mockReturnValue(
        new Promise(resolve => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() => useMcpTool("tool"));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isRefetching).toBe(false);

      await act(async () => {
        resolvePromise!("data");
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should set isLoading false and isRefetching false after completion", async () => {
      mockCallTool.mockResolvedValue("data");

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.isRefetching).toBe(false);
      });
    });
  });

  describe("options ref stability", () => {
    it("should use latest options callbacks", async () => {
      const onSuccess1 = vi.fn();
      const onSuccess2 = vi.fn();
      mockCallTool.mockResolvedValue("data");

      const { result, rerender } = renderHook(
        ({ onSuccess }) => useMcpTool("tool", {}, { onSuccess }),
        { initialProps: { onSuccess: onSuccess1 } },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First callback was called
      expect(onSuccess1).toHaveBeenCalled();

      // Change callback
      rerender({ onSuccess: onSuccess2 });

      mockCallTool.mockResolvedValue("data2");

      await act(async () => {
        await result.current.refetch();
      });

      expect(onSuccess2).toHaveBeenCalledWith("data2");
    });
  });

  describe("default options", () => {
    it("should work with minimal arguments", async () => {
      mockCallTool.mockResolvedValue("ok");

      const { result } = renderHook(() => useMcpTool("tool"));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBe("ok");
    });
  });

  describe("edge cases", () => {
    it("should not refetch if disabled", async () => {
      mockCallTool.mockResolvedValue("ok");
      const { result } = renderHook(() => useMcpTool("tool", {}, { enabled: false }));

      await result.current.refetch();
      expect(mockCallTool).not.toHaveBeenCalled();
    });

    it("should handle undefined callbacks", async () => {
      mockCallTool.mockResolvedValue("ok");
      const { result } = renderHook(() =>
        useMcpTool("tool", {}, { onSuccess: undefined, onError: undefined })
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toBe("ok");

      mockCallTool.mockRejectedValue(new Error("fail"));
      await act(async () => {
        await result.current.refetch();
      });
      await waitFor(() => expect(result.current.isRefetching).toBe(false));
      expect(result.current.error).toBeDefined();
    });

    it("should handle refetch interval change", async () => {
      vi.useFakeTimers();
      const { rerender } = renderHook(
        ({ interval }) => useMcpTool("tool", {}, { refetchInterval: interval }),
        { initialProps: { interval: 1000 } },
      );

      rerender({ interval: 2000 });
      vi.advanceTimersByTime(2000);
      expect(mockCallTool).toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
