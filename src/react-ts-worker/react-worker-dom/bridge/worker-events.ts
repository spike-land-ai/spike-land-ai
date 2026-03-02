// Worker-side event dispatch.
// Receives TransferrableEventData from the main thread, resolves the target
// virtual node, and dispatches through the React handler chain (bubble phase).

import type { TransferrableEventData } from "../events.js";
import type { EventMessage } from "./protocol.js";
import type { WorkerNodeImpl } from "./worker-document.js";

type EventHandler = (event: WorkerSyntheticEvent) => void;

export interface WorkerSyntheticEvent {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  target: WorkerNodeImpl | null;
  currentTarget: WorkerNodeImpl | null;
  timeStamp: number;
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  button: number;
  buttons: number;
  key: string;
  code: string;
  keyCode: number;
  charCode: number;
  which: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  targetValue?: string;
  defaultPrevented: boolean;
  propagationStopped: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

function createSyntheticEvent(
  data: TransferrableEventData & { targetValue?: string },
  target: WorkerNodeImpl | null,
): WorkerSyntheticEvent {
  const event: WorkerSyntheticEvent = {
    type: data.type,
    bubbles: data.bubbles,
    cancelable: data.cancelable,
    target,
    currentTarget: null,
    timeStamp: data.timeStamp,
    clientX: data.clientX ?? 0,
    clientY: data.clientY ?? 0,
    pageX: data.pageX ?? 0,
    pageY: data.pageY ?? 0,
    button: data.button ?? 0,
    buttons: data.buttons ?? 0,
    key: data.key ?? "",
    code: data.code ?? "",
    keyCode: data.keyCode ?? 0,
    charCode: data.charCode ?? 0,
    which: data.which ?? 0,
    ctrlKey: data.ctrlKey ?? false,
    shiftKey: data.shiftKey ?? false,
    altKey: data.altKey ?? false,
    metaKey: data.metaKey ?? false,
    targetValue: data.targetValue,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
  return event;
}

/** Converts a React prop name like "onClick" to the DOM event name "click". */
function propToEventName(propName: string): string | null {
  if (!propName.startsWith("on") || propName.length <= 2) return null;
  // "onClick" -> "click", "onMouseDown" -> "mousedown"
  return propName.charAt(2).toLowerCase() + propName.slice(3).toLowerCase();
}

export class WorkerEventRegistry {
  // nodeId -> eventName -> handler
  private handlers = new Map<number, Map<string, EventHandler>>();

  setHandler(nodeId: number, reactPropName: string, handler: EventHandler): void {
    const eventName = propToEventName(reactPropName);
    if (!eventName) return;

    let nodeHandlers = this.handlers.get(nodeId);
    if (!nodeHandlers) {
      nodeHandlers = new Map();
      this.handlers.set(nodeId, nodeHandlers);
    }
    nodeHandlers.set(eventName, handler);
  }

  removeHandler(nodeId: number, reactPropName: string): void {
    const eventName = propToEventName(reactPropName);
    if (!eventName) return;

    const nodeHandlers = this.handlers.get(nodeId);
    if (!nodeHandlers) return;
    nodeHandlers.delete(eventName);
    if (nodeHandlers.size === 0) {
      this.handlers.delete(nodeId);
    }
  }

  dispatch(
    data: TransferrableEventData & { targetValue?: string },
    nodeMap: Map<number, WorkerNodeImpl>,
  ): void {
    const targetNode = nodeMap.get(data.target) ?? null;
    const syntheticEvent = createSyntheticEvent(data, targetNode);

    // Walk from target up the parent chain (bubble phase)
    let current: WorkerNodeImpl | null = targetNode;
    while (current && !syntheticEvent.propagationStopped) {
      const nodeId = current.__nodeId;
      const nodeHandlers = this.handlers.get(nodeId);
      if (nodeHandlers) {
        const handler = nodeHandlers.get(data.type);
        if (handler) {
          syntheticEvent.currentTarget = current;
          handler(syntheticEvent);
        }
      }
      current = current.parentNode as WorkerNodeImpl | null;
    }
  }
}

/** Sets up the worker's onmessage to dispatch incoming events. */
export function setupWorkerEventReceiver(
  registry: WorkerEventRegistry,
  nodeMap: Map<number, WorkerNodeImpl>,
): void {
  self.addEventListener("message", (ev: MessageEvent<EventMessage>) => {
    if (ev.data.kind === "event") {
      registry.dispatch(
        ev.data.event as TransferrableEventData & { targetValue?: string },
        nodeMap,
      );
    }
  });
}
