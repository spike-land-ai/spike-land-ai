// React DOM Client - createRoot and hydrateRoot entry points

import type { ReactNode } from "../react/ReactTypes.js";
import { DOMHostConfig } from "../host-config/DOMHostConfig.js";
import { createContainer, updateContainer } from "../reconciler/ReactFiberReconciler.js";
import { listenToAllSupportedEvents } from "./events/EventDelegation.js";

export interface Root {
  render(children: ReactNode): void;
  unmount(): void;
}

export interface CreateRootOptions {
  onUncaughtError?: (error: unknown, errorInfo: { componentStack?: string }) => void;
  onCaughtError?: (error: unknown, errorInfo: { componentStack?: string }) => void;
}

export function createRoot(container: Element | Document, _options?: CreateRootOptions): Root {
  if (!container) {
    throw new Error("createRoot(...): Target container is not a DOM element.");
  }

  // Set up event delegation at the root container
  const rootElement = container instanceof Document ? container.documentElement : container;
  listenToAllSupportedEvents(rootElement);

  // Create the fiber root
  const fiberRoot = createContainer(rootElement, DOMHostConfig);

  return {
    render(children: ReactNode): void {
      updateContainer(children, fiberRoot);
    },

    unmount(): void {
      updateContainer(null, fiberRoot);
    },
  };
}

export interface HydrateRootOptions extends CreateRootOptions {
  onRecoverableError?: (error: unknown) => void;
}

export function hydrateRoot(
  container: Element | Document,
  initialChildren: ReactNode,
  options?: HydrateRootOptions,
): Root {
  // For now, hydration just does a client render
  // Full hydration support would match existing DOM nodes to fibers
  const root = createRoot(container, options);
  root.render(initialChildren);
  return root;
}
