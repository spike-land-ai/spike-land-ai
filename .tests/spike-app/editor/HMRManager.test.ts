import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HMRManager } from "@/ui/components/editor/HMRManager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIframe(contentWindow: Window | null = null) {
  const iframe = document.createElement("iframe");
  Object.defineProperty(iframe, "contentWindow", {
    value: contentWindow ?? window,
    writable: false,
  });
  return iframe;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HMRManager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts hmr:update message to the iframe contentWindow", () => {
    const postMessage = vi.fn();
    const fakeWindow = { postMessage } as unknown as Window;
    const iframe = makeIframe(fakeWindow);

    const manager = new HMRManager(iframe);
    manager.update("<html>", "const x=1;");

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "hmr:update", code: "const x=1;" }),
      "*",
    );

    manager.destroy();
  });

  it("calls onFullReload after HMR_ACK_TIMEOUT when no ack arrives", () => {
    const onFullReload = vi.fn();
    const postMessage = vi.fn();
    const fakeWindow = { postMessage } as unknown as Window;
    const iframe = makeIframe(fakeWindow);

    const manager = new HMRManager(iframe, onFullReload);
    manager.update("<html>", "const x=1;");

    vi.advanceTimersByTime(2_000);

    expect(onFullReload).toHaveBeenCalledWith("<html>");
    manager.destroy();
  });

  it("does NOT call onFullReload when ack arrives in time", () => {
    const onFullReload = vi.fn();
    let capturedTimestamp: number | null = null;
    const postMessage = vi.fn((payload: { type: string; timestamp: number }) => {
      capturedTimestamp = payload.timestamp;
    });
    const fakeWindow = { postMessage } as unknown as Window;
    const iframe = makeIframe(fakeWindow);

    const manager = new HMRManager(iframe, onFullReload);
    manager.update("<html>", "const x=1;");

    // Simulate ack from the iframe
    const ackEvent = new MessageEvent("message", {
      source: fakeWindow as unknown as WindowProxy,
      data: { type: "hmr:ack", timestamp: capturedTimestamp },
    });
    window.dispatchEvent(ackEvent);

    vi.advanceTimersByTime(2_000);

    expect(onFullReload).not.toHaveBeenCalled();
    manager.destroy();
  });

  it("does nothing after destroy is called", () => {
    const postMessage = vi.fn();
    const fakeWindow = { postMessage } as unknown as Window;
    const iframe = makeIframe(fakeWindow);

    const manager = new HMRManager(iframe);
    manager.destroy();
    manager.update("<html>", "code");

    expect(postMessage).not.toHaveBeenCalled();
  });
});
