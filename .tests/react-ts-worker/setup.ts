/**
 * Vitest setup for react-ts-worker tests.
 *
 * The Scheduler uses MessageChannel to schedule work. In Node.js, a
 * MessagePort with an onmessage listener is automatically ref()'d, which
 * keeps the event loop alive after tests complete.
 *
 * We replace the global MessageChannel with a wrapper that automatically
 * unref()'s the port after it has a listener attached, preventing the
 * process from hanging after tests finish.
 */

const OriginalMessageChannel = globalThis.MessageChannel;

class _UnrefMessageChannel extends OriginalMessageChannel {
  get port1() {
    const port = super.port1;
    // Intercept onmessage setter to unref the port
    let _handler: ((ev: MessageEvent) => void) | null = null;
    Object.defineProperty(port, "onmessage", {
      get() {
        return _handler;
      },
      set(fn) {
        _handler = fn;
        if (fn && typeof (port as unknown as { unref?: () => void }).unref === "function") {
          (port as unknown as { unref: () => void }).unref();
        }
        // Manually call start since we intercepted the onmessage setter
        port.start();
        // Re-assign through the raw EventTarget approach
        port.addEventListener("message", fn);
      },
      configurable: true,
    });
    return port;
  }
}

// Replace MessageChannel globally so the Scheduler uses our unref'd version
// Note: The Scheduler captures MessageChannel at import time, so we need to
// replace it before the Scheduler module is imported. Since this setup file
// runs before test files, this works as long as we use dynamic imports in tests.
// For static imports, the Scheduler has already captured the original.
// In that case, we handle cleanup via afterAll in individual test files.
export {};
