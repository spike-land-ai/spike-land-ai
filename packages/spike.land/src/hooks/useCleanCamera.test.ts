// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCleanCamera } from "./useCleanCamera";

const mockGetUserMedia = vi.fn();
const mockPermissionsQuery = vi.fn();
const mockTrackStop = vi.fn();

function createMockStream(): MediaStream {
  return {
    getTracks: () => [{ stop: mockTrackStop }],
  } as unknown as MediaStream;
}

describe("useCleanCamera", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "navigator", {
      value: {
        mediaDevices: { getUserMedia: mockGetUserMedia },
        permissions: { query: mockPermissionsQuery },
        userAgent: "test-agent",
      },
      writable: true,
      configurable: true,
    });
    mockPermissionsQuery.mockResolvedValue({ state: "prompt" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with null error and errorKind", () => {
    const { result } = renderHook(() => useCleanCamera());
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
    expect(result.current.permissionState).toBeNull();
  });

  it("sets permission-denied error for NotAllowedError", async () => {
    const err = new DOMException("Permission denied", "NotAllowedError");
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.error).toBe("Camera permission denied");
    expect(result.current.errorKind).toBe("permission-denied");
    expect(result.current.permissionState).toBe("denied");
  });

  it("sets no-camera error for NotFoundError", async () => {
    const err = new DOMException("No device", "NotFoundError");
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.error).toBe("No camera detected on this device");
    expect(result.current.errorKind).toBe("no-camera");
  });

  it("sets not-supported error when mediaDevices is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "test" },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.error).toBe("Camera requires a secure connection (HTTPS)");
    expect(result.current.errorKind).toBe("not-supported");
  });

  it("sets unknown error for NotReadableError", async () => {
    const err = new DOMException("In use", "NotReadableError");
    mockGetUserMedia.mockRejectedValue(err);

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.error).toBe("Camera is in use by another application");
    expect(result.current.errorKind).toBe("unknown");
  });

  it("sets granted permission state on success", async () => {
    mockGetUserMedia.mockResolvedValue(createMockStream());

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.permissionState).toBe("granted");
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
  });

  it("handles permissions.query not supporting camera", async () => {
    mockPermissionsQuery.mockRejectedValue(new TypeError("not supported"));
    mockGetUserMedia.mockResolvedValue(createMockStream());

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.permissionState).toBe("granted");
    expect(result.current.error).toBeNull();
  });

  it("clears error on retry", async () => {
    const err = new DOMException("No device", "NotFoundError");
    mockGetUserMedia.mockRejectedValueOnce(err);

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });
    expect(result.current.errorKind).toBe("no-camera");

    mockGetUserMedia.mockResolvedValueOnce(createMockStream());
    await act(async () => {
      await result.current.requestCamera();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.errorKind).toBeNull();
  });

  it("handles non-Error thrown values", async () => {
    mockGetUserMedia.mockRejectedValue("string error");

    const { result } = renderHook(() => useCleanCamera());
    await act(async () => {
      await result.current.requestCamera();
    });

    expect(result.current.error).toBe("Camera access denied");
    expect(result.current.errorKind).toBe("unknown");
  });
});
