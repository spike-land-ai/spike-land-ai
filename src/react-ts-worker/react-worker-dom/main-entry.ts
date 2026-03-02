// Main Thread Entry - Initializes worker-dom and connects it to a React app running in a worker

// This module runs on the main thread and:
// 1. Creates a Worker from a blob URL or module URL
// 2. Sets up the MainThreadApplier to apply mutations from the worker
// 3. Captures user events and forwards them to the worker

import { MainThreadApplier } from "./bridge/main-applier.js";

export interface MainEntryOptions {
  // URL to the worker script that imports react-worker-dom/worker-entry
  workerUrl: string | URL;
  // The DOM element to render into
  container: HTMLElement;
  // Optional: worker-dom's upgrade function if already loaded
  upgrade?: (element: Element, workerUrl: string | URL) => void;
}

let activeApplier: MainThreadApplier | null = null;

export async function mount(options: MainEntryOptions): Promise<MainThreadApplier> {
  const { workerUrl, container } = options;

  if (options.upgrade) {
    // Use provided upgrade function (from worker-dom's install.ts)
    options.upgrade(container, workerUrl);
    // The worker is managed by worker-dom internally
    return null as unknown as MainThreadApplier;
  }

  // Create MainThreadApplier which handles worker creation, mutation application,
  // and event forwarding
  const urlStr = typeof workerUrl === "string" ? workerUrl : workerUrl.toString();
  activeApplier = new MainThreadApplier(container, urlStr);
  return activeApplier;
}

export function unmount(): void {
  if (activeApplier) {
    activeApplier.destroy();
    activeApplier = null;
  }
}

// Re-export for direct use
export { MainThreadApplier } from "./bridge/main-applier.js";
