// Worker-DOM Event Bridge
// Bridges worker-dom's TransferrableEvent to React's synthetic event system

// worker-dom captures events on the main thread, serializes them,
// and sends them to the worker via postMessage.
// This module integrates that with React's event delegation.

export interface TransferrableEventData {
  type: string;
  bubbles: boolean;
  cancelable: boolean;
  target: number; // Node transfer ID
  currentTarget: number;
  timeStamp: number;
  // Mouse event data
  clientX?: number;
  clientY?: number;
  pageX?: number;
  pageY?: number;
  button?: number;
  buttons?: number;
  // Keyboard event data
  key?: string;
  code?: string;
  keyCode?: number;
  charCode?: number;
  which?: number;
  // Modifier keys
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

// Create a DOM-like Event object from worker-dom's transferrable data
export function createEventFromTransfer(data: TransferrableEventData): Event {
  // Create a basic event
  const event = new Event(data.type, {
    bubbles: data.bubbles,
    cancelable: data.cancelable,
  });

  // Copy additional properties
  Object.defineProperties(event, {
    clientX: { value: data.clientX ?? 0 },
    clientY: { value: data.clientY ?? 0 },
    pageX: { value: data.pageX ?? 0 },
    pageY: { value: data.pageY ?? 0 },
    button: { value: data.button ?? 0 },
    buttons: { value: data.buttons ?? 0 },
    key: { value: data.key ?? "" },
    code: { value: data.code ?? "" },
    keyCode: { value: data.keyCode ?? 0 },
    charCode: { value: data.charCode ?? 0 },
    which: { value: data.which ?? 0 },
    ctrlKey: { value: data.ctrlKey ?? false },
    shiftKey: { value: data.shiftKey ?? false },
    altKey: { value: data.altKey ?? false },
    metaKey: { value: data.metaKey ?? false },
    timeStamp: { value: data.timeStamp },
  });

  return event;
}

// Set up event forwarding from worker-dom to React's event system
export function setupEventForwarding(
  onEvent: (event: Event, targetNodeId: number) => void,
): (data: TransferrableEventData) => void {
  return (data: TransferrableEventData) => {
    const event = createEventFromTransfer(data);
    onEvent(event, data.target);
  };
}

// Event types that worker-dom captures by default
export const CAPTURED_EVENTS = [
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "mousemove",
  "mouseover",
  "mouseout",
  "mouseenter",
  "mouseleave",
  "touchstart",
  "touchend",
  "touchmove",
  "touchcancel",
  "keydown",
  "keyup",
  "keypress",
  "focus",
  "blur",
  "focusin",
  "focusout",
  "input",
  "change",
  "submit",
  "reset",
  "scroll",
  "wheel",
  "pointerdown",
  "pointerup",
  "pointermove",
  "pointerenter",
  "pointerleave",
  "pointerover",
  "pointerout",
  "contextmenu",
  "drag",
  "dragstart",
  "dragend",
  "dragenter",
  "dragleave",
  "dragover",
  "drop",
] as const;
