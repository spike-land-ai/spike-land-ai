import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mockCallTool = vi.hoisted(() => vi.fn());
vi.mock("../mcp-client", () => ({ callTool: mockCallTool }));

// Mock XMLHttpRequest
type XHREventHandler = ((event: ProgressEvent) => void) | null;

class MockXMLHttpRequest {
  open = vi.fn();
  send = vi.fn();
  setRequestHeader = vi.fn();
  status = 200;

  onload: XHREventHandler = null;
  onerror: XHREventHandler = null;
  onabort: XHREventHandler = null;

  upload = {
    onprogress: null as XHREventHandler,
  };

  static lastInstance: MockXMLHttpRequest | null = null;

  constructor() {
    MockXMLHttpRequest.lastInstance = this;
  }

  static reset() {
    MockXMLHttpRequest.lastInstance = null;
  }
}

import { useMcpUpload } from "./use-mcp-upload";

describe("useMcpUpload", () => {
  beforeEach(() => {
    mockCallTool.mockReset();
    MockXMLHttpRequest.reset();
    vi.stubGlobal("XMLHttpRequest", MockXMLHttpRequest);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createMockFile(name = "test.png", type = "image/png"): File {
    return new File(["file-content"], name, { type });
  }

  describe("initial state", () => {
    it("should return initial idle state", () => {
      const { result } = renderHook(() => useMcpUpload("image"));

      expect(result.current.progress).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.result).toBeNull();
      expect(typeof result.current.upload).toBe("function");
    });
  });

  describe("upload - full success flow", () => {
    it("should get presigned URL, upload to R2, and register", async () => {
      const presigned = {
        upload_url: "https://r2.example.com/upload?token=abc",
        r2_key: "uploads/test.png",
      };
      const registrationResult = {
        id: "asset-123",
        url: "https://cdn.example.com/test.png",
      };

      // callTool is called twice: first for presigned, then for register
      mockCallTool
        .mockResolvedValueOnce(presigned)
        .mockResolvedValueOnce(registrationResult);

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image"));

      let uploadPromise: Promise<unknown>;

      // Start the upload - the first callTool happens immediately
      await act(async () => {
        uploadPromise = result.current.upload(file, { alt: "test image" });
        // Let the presigned URL call resolve
        await Promise.resolve();
        await Promise.resolve();
      });

      // Check that the presigned URL was requested
      expect(mockCallTool).toHaveBeenCalledWith("storage_get_upload_url", {
        filename: "test.png",
        content_type: "image/png",
        purpose: "image",
      });

      // XHR should have been created and configured
      const xhr = MockXMLHttpRequest.lastInstance!;
      expect(xhr).not.toBeNull();
      expect(xhr.open).toHaveBeenCalledWith("PUT", presigned.upload_url);
      expect(xhr.setRequestHeader).toHaveBeenCalledWith(
        "Content-Type",
        "image/png",
      );
      expect(xhr.send).toHaveBeenCalledWith(file);

      // Simulate successful upload
      await act(async () => {
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));
        await uploadPromise!;
      });

      // Check registration was called
      expect(mockCallTool).toHaveBeenCalledWith("storage_register_upload", {
        r2_key: "uploads/test.png",
        purpose: "image",
        metadata: { alt: "test image" },
      });

      expect(result.current.result).toEqual(registrationResult);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeUndefined();
    });

    it("should return registration result from upload", async () => {
      const registrationResult = { id: "asset-456" };
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce(registrationResult);

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("asset"));

      let returnValue: unknown;

      await act(async () => {
        const promise = result.current.upload(file);
        // Wait for presigned URL to resolve and XHR to be created
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        returnValue = await promise;
      });

      expect(returnValue).toEqual(registrationResult);
    });

    it("should use empty object as default metadata", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("brand"));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      expect(mockCallTool).toHaveBeenCalledWith("storage_register_upload", {
        r2_key: "key",
        purpose: "brand",
        metadata: {},
      });
    });
  });

  describe("upload - progress tracking", () => {
    it("should update progress on XHR upload progress", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      const onProgress = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onProgress }));

      await act(async () => {
        const promise = result.current.upload(file);
        // Wait for presigned URL to resolve
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;

        // Simulate progress events
        xhr.upload.onprogress!(
          new ProgressEvent("progress", {
            lengthComputable: true,
            loaded: 50,
            total: 100,
          }),
        );

        expect(onProgress).toHaveBeenCalledWith(50);

        xhr.upload.onprogress!(
          new ProgressEvent("progress", {
            lengthComputable: true,
            loaded: 100,
            total: 100,
          }),
        );

        expect(onProgress).toHaveBeenCalledWith(100);

        // Complete the upload
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));
        await promise;
      });

      expect(result.current.progress).toBe(100);
    });

    it("should ignore non-computable progress events", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      const onProgress = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onProgress }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;

        xhr.upload.onprogress!(
          new ProgressEvent("progress", {
            lengthComputable: false,
            loaded: 0,
            total: 0,
          }),
        );

        expect(onProgress).not.toHaveBeenCalled();

        // Complete the upload
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));
        await promise;
      });

      expect(result.current.progress).toBe(0);
    });
  });

  describe("upload - onSuccess callback", () => {
    it("should call onSuccess with registration result", async () => {
      const registrationResult = { id: "asset-789" };
      const onSuccess = vi.fn();

      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce(registrationResult);

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("audio", { onSuccess }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      expect(onSuccess).toHaveBeenCalledWith(registrationResult);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("upload - error handling", () => {
    it("should handle presigned URL failure", async () => {
      const testError = new Error("Failed to get presigned URL");
      mockCallTool.mockRejectedValue(testError);
      const onError = vi.fn();

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onError }));

      await act(async () => {
        try {
          await result.current.upload(file);
        } catch {
          // expected - the hook re-throws
        }
      });

      expect(result.current.error).toBe(testError);
      expect(result.current.isLoading).toBe(false);
      expect(onError).toHaveBeenCalledWith(testError);
    });

    it("should handle XHR upload failure (non-2xx status)", async () => {
      mockCallTool.mockResolvedValueOnce({
        upload_url: "https://r2.example.com/up",
        r2_key: "key",
      });

      const onError = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onError }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 500;
        xhr.onload!(new ProgressEvent("load"));

        try {
          await promise;
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe(
        "Upload failed with status 500",
      );
      expect(result.current.isLoading).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it("should handle XHR network error", async () => {
      mockCallTool.mockResolvedValueOnce({
        upload_url: "https://r2.example.com/up",
        r2_key: "key",
      });

      const onError = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onError }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.onerror!(new ProgressEvent("error"));

        try {
          await promise;
        } catch {
          // expected
        }
      });

      expect(result.current.error?.message).toBe("Network error during upload");
      expect(result.current.isLoading).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it("should handle XHR abort", async () => {
      mockCallTool.mockResolvedValueOnce({
        upload_url: "https://r2.example.com/up",
        r2_key: "key",
      });

      const onError = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onError }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.onabort!(new ProgressEvent("abort"));

        try {
          await promise;
        } catch {
          // expected
        }
      });

      expect(result.current.error?.message).toBe("Upload aborted");
      expect(onError).toHaveBeenCalled();
    });

    it("should handle registration failure after successful upload", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockRejectedValueOnce(new Error("Registration failed"));

      const onError = vi.fn();
      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image", { onError }));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        try {
          await promise;
        } catch {
          // expected
        }
      });

      expect(result.current.error?.message).toBe("Registration failed");
      expect(result.current.isLoading).toBe(false);
      expect(onError).toHaveBeenCalled();
    });

    it("should wrap non-Error thrown values", async () => {
      mockCallTool.mockRejectedValue("string error");

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image"));

      await act(async () => {
        try {
          await result.current.upload(file);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe("Unknown error");
    });

    it("should re-throw error from upload", async () => {
      mockCallTool.mockRejectedValue(new Error("fail"));

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image"));

      await act(async () => {
        await expect(result.current.upload(file)).rejects.toThrow("fail");
      });
    });
  });

  describe("state reset on new upload", () => {
    it("should reset progress and error on new upload", async () => {
      // First upload fails
      mockCallTool.mockRejectedValueOnce(new Error("fail"));

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image"));

      await act(async () => {
        try {
          await result.current.upload(file);
        } catch {
          // expected
        }
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe("fail");

      // Second upload starts - should reset state
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      // After the second upload completes successfully, error should be cleared
      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.result).toEqual({ id: "ok" });
    });
  });

  describe("purpose parameter", () => {
    it("should pass purpose to storage_get_upload_url and register", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      const file = createMockFile("audio.mp3", "audio/mpeg");
      const { result } = renderHook(() => useMcpUpload("audio"));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      expect(mockCallTool).toHaveBeenCalledWith("storage_get_upload_url", {
        filename: "audio.mp3",
        content_type: "audio/mpeg",
        purpose: "audio",
      });

      expect(mockCallTool).toHaveBeenCalledWith("storage_register_upload", {
        r2_key: "key",
        purpose: "audio",
        metadata: {},
      });
    });
  });

  describe("options ref stability", () => {
    it("should use the latest callbacks without re-creating upload", async () => {
      const onSuccess1 = vi.fn();
      const onSuccess2 = vi.fn();

      const registrationResult = { id: "asset" };
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce(registrationResult);

      const { result, rerender } = renderHook(
        ({ onSuccess }) => useMcpUpload("image", { onSuccess }),
        { initialProps: { onSuccess: onSuccess1 } },
      );

      const uploadRef = result.current.upload;
      rerender({ onSuccess: onSuccess2 });

      // upload reference should be stable (same purpose)
      expect(result.current.upload).toBe(uploadRef);

      const file = createMockFile();

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      expect(onSuccess1).not.toHaveBeenCalled();
      expect(onSuccess2).toHaveBeenCalledWith(registrationResult);
    });
  });

  describe("default options", () => {
    it("should work without options argument", async () => {
      mockCallTool
        .mockResolvedValueOnce({
          upload_url: "https://r2.example.com/up",
          r2_key: "key",
        })
        .mockResolvedValueOnce({ id: "ok" });

      const file = createMockFile();
      const { result } = renderHook(() => useMcpUpload("image"));

      await act(async () => {
        const promise = result.current.upload(file);
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));

        await promise;
      });

      expect(result.current.result).toEqual({ id: "ok" });
    });
  });

  describe("uploadAsync and undefined callbacks", () => {
    it("should handle uploadAsync and undefined callbacks", async () => {
      mockCallTool
        .mockResolvedValueOnce({ upload_url: "http://url", r2_key: "key" })
        .mockResolvedValueOnce({ id: "ok" });

      const { result } = renderHook(() =>
        useMcpUpload("image", { onSuccess: undefined, onError: undefined })
      );

      let asyncResult;
      await act(async () => {
        const promise = result.current.upload(createMockFile());
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        const xhr = MockXMLHttpRequest.lastInstance!;
        xhr.status = 200;
        xhr.onload!(new ProgressEvent("load"));
        asyncResult = await promise;
      });

      expect(asyncResult).toEqual({ id: "ok" });
      expect(result.current.result).toEqual({ id: "ok" });
    });
  });
});
