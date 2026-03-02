// Event Delegation - Attach listeners at root container, walk fiber tree to dispatch

import { createSyntheticEvent } from "./SyntheticEvent.js";
import {
  getAllNativeEvents,
  getReactNamesForNativeEvent,
  isNonBubblingEvent,
} from "./EventRegistry.js";
import { HostComponent } from "../../reconciler/ReactWorkTags.js";

// We store the fiber on DOM nodes via this property
const FIBER_KEY = "__reactFiber$";
const PROPS_KEY = "__reactProps$";

// Internal fiber type - minimal interface needed for event dispatch
interface MinimalFiber {
  tag: number;
  stateNode: unknown;
  return: MinimalFiber | null;
  memoizedProps: Record<string, unknown> | null;
}

export function setFiberOnNode(node: Node, fiber: unknown): void {
  (node as unknown as Record<string, unknown>)[FIBER_KEY] = fiber;
}

export function setPropsOnNode(node: Node, props: Record<string, unknown>): void {
  (node as unknown as Record<string, unknown>)[PROPS_KEY] = props;
}

function getFiberFromNode(node: Node): MinimalFiber | null {
  return ((node as unknown as Record<string, unknown>)[FIBER_KEY] as MinimalFiber) || null;
}

function getPropsFromNode(node: Node): Record<string, unknown> | null {
  return (
    ((node as unknown as Record<string, unknown>)[PROPS_KEY] as Record<string, unknown>) || null
  );
}

// Collect all React event listeners along the fiber path (from target to root)
interface DispatchListener {
  fiber: MinimalFiber;
  handler: (event: unknown) => void;
  currentTarget: EventTarget;
}

function collectListeners(
  targetFiber: MinimalFiber | null,
  reactName: string,
  isCapture: boolean,
): DispatchListener[] {
  const listeners: DispatchListener[] = [];
  let fiber = targetFiber;

  while (fiber !== null) {
    // Only HostComponent fibers (tag=5) have DOM nodes with event props
    if (fiber.tag === HostComponent && fiber.stateNode) {
      const props = getPropsFromNode(fiber.stateNode as Node) || fiber.memoizedProps;
      if (props) {
        const propName = isCapture ? reactName + "Capture" : reactName;
        const handler = props[propName];
        if (typeof handler === "function") {
          listeners.push({
            fiber,
            handler: handler as (event: unknown) => void,
            currentTarget: fiber.stateNode as EventTarget,
          });
        }
      }
    }
    fiber = fiber.return;
  }

  return listeners;
}

function dispatchEvent(nativeEventName: string, nativeEvent: Event, _container: Element): void {
  const target = nativeEvent.target || nativeEvent.srcElement;
  if (!target) return;

  // Find the fiber for the target node
  let targetNode: Node | null = target as Node;
  let targetFiber: MinimalFiber | null = null;

  // Walk up from event target to find a node with a fiber
  while (targetNode !== null) {
    targetFiber = getFiberFromNode(targetNode);
    if (targetFiber !== null) break;
    targetNode = targetNode.parentNode;
  }

  // Get React event names for this native event
  const reactNames = getReactNamesForNativeEvent(nativeEventName);

  for (const reactName of reactNames) {
    const syntheticEvent = createSyntheticEvent(reactName, nativeEvent, target);

    // Capture phase - dispatch from root to target
    const captureListeners = collectListeners(targetFiber, reactName, true);
    for (let i = captureListeners.length - 1; i >= 0; i--) {
      if (syntheticEvent.isPropagationStopped()) break;
      const listener = captureListeners[i]!;
      syntheticEvent.currentTarget = listener.currentTarget;
      listener.handler(syntheticEvent);
    }

    // Bubble phase - dispatch from target to root
    if (!syntheticEvent.isPropagationStopped()) {
      const bubbleListeners = collectListeners(targetFiber, reactName, false);
      for (let i = 0; i < bubbleListeners.length; i++) {
        if (syntheticEvent.isPropagationStopped()) break;
        const listener = bubbleListeners[i]!;
        syntheticEvent.currentTarget = listener.currentTarget;
        listener.handler(syntheticEvent);
      }
    }

    syntheticEvent.currentTarget = null;
  }
}

const listeningContainers = new WeakSet<Element>();

export function listenToAllSupportedEvents(container: Element): void {
  if (listeningContainers.has(container)) return;
  listeningContainers.add(container);

  const allNativeEvents = getAllNativeEvents();

  for (const nativeEventName of allNativeEvents) {
    const useCapture = isNonBubblingEvent(nativeEventName);

    container.addEventListener(
      nativeEventName,
      (nativeEvent: Event) => {
        dispatchEvent(nativeEventName, nativeEvent, container);
      },
      useCapture,
    );

    // Also listen in capture phase for bubbling events
    if (!useCapture) {
      container.addEventListener(
        nativeEventName,
        (nativeEvent: Event) => {
          dispatchEvent(nativeEventName, nativeEvent, container);
        },
        true,
      );
    }
  }
}
