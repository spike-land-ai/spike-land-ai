import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockCallTool = vi.hoisted(() => vi.fn());
vi.mock("../mcp-client", () => ({ callTool: mockCallTool }));

import { useMcpMutation } from "./use-mcp-mutation";

describe("useMcpMutation", () => {
  beforeEach(() => {
    mockCallTool.mockReset();
  });

  describe("initial state", () => {
    it("should return initial idle state", () => {
      const { result } = renderHook(() => useMcpMutation("test_tool"));

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(typeof result.current.mutate).toBe("function");
      expect(typeof result.current.reset).toBe("function");
    });
  });

  describe("mutate - success", () => {
    it("should set isLoading to true during mutation", async () => {
      let resolvePromise: (value: unknown) => void;
      mockCallTool.mockReturnValue(
        new Promise(resolve => {
          resolvePromise = resolve;
        }),
      );

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      let mutatePromise: Promise<unknown>;
      act(() => {
        mutatePromise = result.current.mutate({ key: "value" });
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        resolvePromise!({ success: true });
        await mutatePromise!;
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should set data on success", async () => {
      const responseData = { id: 1, name: "test" };
      mockCallTool.mockResolvedValue(responseData);

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        await result.current.mutate({ key: "value" });
      });

      expect(result.current.data).toEqual(responseData);
      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it("should call callTool with the correct name and args", async () => {
      mockCallTool.mockResolvedValue("ok");

      const { result } = renderHook(() => useMcpMutation("my_tool"));

      await act(async () => {
        await result.current.mutate({ foo: "bar" });
      });

      expect(mockCallTool).toHaveBeenCalledWith("my_tool", { foo: "bar" });
    });

    it("should use empty object as default args", async () => {
      mockCallTool.mockResolvedValue("ok");

      const { result } = renderHook(() => useMcpMutation("my_tool"));

      await act(async () => {
        await result.current.mutate();
      });

      expect(mockCallTool).toHaveBeenCalledWith("my_tool", {});
    });

    it("should return data from mutateAsync", async () => {
      const responseData = { result: "success" };
      mockCallTool.mockResolvedValue(responseData);

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      let returnValue: unknown;
      await act(async () => {
        returnValue = await result.current.mutateAsync();
      });

      expect(returnValue).toEqual(responseData);
    });

    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const responseData = { id: 42 };
      mockCallTool.mockResolvedValue(responseData);

      const { result } = renderHook(() => useMcpMutation("test_tool", { onSuccess }));

      await act(async () => {
        await result.current.mutate();
      });

      expect(onSuccess).toHaveBeenCalledWith(responseData);
    });

    it("should clear error on subsequent success", async () => {
      mockCallTool.mockRejectedValueOnce(new Error("fail"));
      mockCallTool.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      // First call fails
      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeDefined();

      // Second call succeeds
      await act(async () => {
        await result.current.mutate();
      });

      expect(result.current.error).toBeUndefined();
      expect(result.current.data).toEqual({ ok: true });
    });
  });

  describe("mutate - error handling", () => {
    it("should set error on failure with Error instance", async () => {
      const testError = new Error("Something went wrong");
      mockCallTool.mockRejectedValue(testError);

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.isLoading).toBe(false);
    });

    it("should wrap non-Error thrown values", async () => {
      mockCallTool.mockRejectedValue("string error");

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Unknown error");
    });

    it("should re-throw the error from mutateAsync", async () => {
      const testError = new Error("test");
      mockCallTool.mockRejectedValue(testError);

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        await expect(result.current.mutateAsync()).rejects.toThrow("test");
      });
    });

    it("should call onError callback", async () => {
      const onError = vi.fn();
      const testError = new Error("broken");
      mockCallTool.mockRejectedValue(testError);

      const { result } = renderHook(() => useMcpMutation("test_tool", { onError }));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(onError).toHaveBeenCalledWith(testError);
    });

    it("should call onError with wrapped error for non-Error values", async () => {
      const onError = vi.fn();
      mockCallTool.mockRejectedValue(42);

      const { result } = renderHook(() => useMcpMutation("test_tool", { onError }));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Unknown error" }),
      );
    });

    it("should set isLoading false even on error", async () => {
      mockCallTool.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("reset", () => {
    it("should reset data, error, and isLoading", async () => {
      mockCallTool.mockResolvedValue({ result: "data" });

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        await result.current.mutate();
      });

      expect(result.current.data).toBeDefined();

      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toBeUndefined();
      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });

    it("should reset error state", async () => {
      mockCallTool.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        try {
          await result.current.mutate();
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeDefined();

      act(() => {
        result.current.reset();
      });

      expect(result.current.error).toBeUndefined();
    });
  });

  describe("options ref stability", () => {
    it("should use the latest options callbacks without re-creating mutate", async () => {
      const onSuccess1 = vi.fn();
      const onSuccess2 = vi.fn();
      mockCallTool.mockResolvedValue("data");

      const { result, rerender } = renderHook(
        ({ onSuccess }) => useMcpMutation("test_tool", { onSuccess }),
        { initialProps: { onSuccess: onSuccess1 } },
      );

      const mutateRef = result.current.mutate;

      rerender({ onSuccess: onSuccess2 });

      // mutate reference should be stable (same name)
      expect(result.current.mutate).toBe(mutateRef);

      await act(async () => {
        await result.current.mutate();
      });

      expect(onSuccess1).not.toHaveBeenCalled();
      expect(onSuccess2).toHaveBeenCalledWith("data");
    });
  });

  describe("default options", () => {
    it("should work without options argument", async () => {
      mockCallTool.mockResolvedValue("ok");

      const { result } = renderHook(() => useMcpMutation("test_tool"));

      await act(async () => {
        await result.current.mutate();
      });

      expect(result.current.data).toBe("ok");
    });
  });
});
