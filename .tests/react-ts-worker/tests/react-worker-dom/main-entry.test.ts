import { beforeEach, describe, expect, it, vi } from "vitest";

class MockWorker {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(_url: string, _options?: unknown) {}
}

vi.stubGlobal("Worker", MockWorker);

const { mount, unmount, MainThreadApplier } = await import(
  "../../../../src/core/react-engine/react-worker-dom/main-entry.js"
);

describe("main-entry", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    // Reset active applier by calling unmount first
    unmount();
  });

  it("exports MainThreadApplier", () => {
    expect(MainThreadApplier).toBeDefined();
  });

  it("mount creates a MainThreadApplier", async () => {
    const applier = await mount({ workerUrl: "blob:fake", container });
    expect(applier).toBeDefined();
    document.body.removeChild(container);
  });

  it("mount with upgrade function uses upgrade", async () => {
    const upgrade = vi.fn();
    const _result = await mount({ workerUrl: "blob:fake", container, upgrade });
    expect(upgrade).toHaveBeenCalledWith(container, "blob:fake");
    document.body.removeChild(container);
  });

  it("unmount destroys active applier", async () => {
    const applier = await mount({ workerUrl: "blob:fake", container });
    const destroySpy = vi.spyOn(applier, "destroy");
    unmount();
    expect(destroySpy).toHaveBeenCalled();
    document.body.removeChild(container);
  });

  it("unmount with no active applier does not throw", () => {
    expect(() => unmount()).not.toThrow();
  });
});
