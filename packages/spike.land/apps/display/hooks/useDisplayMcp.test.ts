import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockMutateAsync = vi.hoisted(() => vi.fn());
const mockReset = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mcp/client/hooks/use-mcp-mutation", () => ({
  useMcpMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: mockMutateAsync,
    data: undefined,
    error: undefined,
    isLoading: false,
    reset: mockReset,
  }),
}));

import { useDisplayMcp } from "./useDisplayMcp";

const FALLBACK_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

describe("useDisplayMcp", () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockReset.mockReset();
  });

  describe("initial state", () => {
    it("returns fetchIceServers, isLoadingCredentials, credentialsError, resetCredentials", () => {
      const { result } = renderHook(() => useDisplayMcp());

      expect(typeof result.current.fetchIceServers).toBe("function");
      expect(result.current.isLoadingCredentials).toBe(false);
      expect(result.current.credentialsError).toBeUndefined();
      expect(typeof result.current.resetCredentials).toBe("function");
    });
  });

  describe("fetchIceServers - success", () => {
    it("returns iceServers from mutation response", async () => {
      const iceServers = [{ urls: "turn:turn.example.com", username: "user", credential: "pass" }];
      mockMutateAsync.mockResolvedValue({ iceServers });

      const { result } = renderHook(() => useDisplayMcp());

      let servers: unknown;
      await act(async () => {
        servers = await result.current.fetchIceServers();
      });

      expect(servers).toEqual(iceServers);
    });

    it("calls mutateAsync with empty args", async () => {
      mockMutateAsync.mockResolvedValue({ iceServers: [] });

      const { result } = renderHook(() => useDisplayMcp());

      await act(async () => {
        await result.current.fetchIceServers();
      });

      expect(mockMutateAsync).toHaveBeenCalledWith({});
    });

    it("returns fallback when response has no iceServers", async () => {
      mockMutateAsync.mockResolvedValue({});

      const { result } = renderHook(() => useDisplayMcp());

      let servers: unknown;
      await act(async () => {
        servers = await result.current.fetchIceServers();
      });

      expect(servers).toEqual(FALLBACK_SERVERS);
    });

    it("returns fallback when response is null", async () => {
      mockMutateAsync.mockResolvedValue(null);

      const { result } = renderHook(() => useDisplayMcp());

      let servers: unknown;
      await act(async () => {
        servers = await result.current.fetchIceServers();
      });

      expect(servers).toEqual(FALLBACK_SERVERS);
    });
  });

  describe("fetchIceServers - error handling", () => {
    it("returns fallback ICE servers when mutation fails", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Network timeout"));

      const { result } = renderHook(() => useDisplayMcp());

      let servers: unknown;
      await act(async () => {
        servers = await result.current.fetchIceServers();
      });

      expect(servers).toEqual(FALLBACK_SERVERS);
    });

    it("does not throw when mutation rejects", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Unauthorized"));

      const { result } = renderHook(() => useDisplayMcp());

      await act(async () => {
        await expect(result.current.fetchIceServers()).resolves.toEqual(FALLBACK_SERVERS);
      });
    });
  });

  describe("resetCredentials", () => {
    it("delegates to mutation reset", () => {
      const { result } = renderHook(() => useDisplayMcp());

      act(() => {
        result.current.resetCredentials();
      });

      expect(mockReset).toHaveBeenCalled();
    });
  });
});
