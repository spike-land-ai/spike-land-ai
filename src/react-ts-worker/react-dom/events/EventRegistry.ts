// Event Registry - Maps React event names to native DOM event names

export interface EventRegistration {
  reactName: string;
  nativeEvents: string[];
  isCapture: boolean;
}

// React event name -> native event names mapping
const EVENT_MAP: Record<string, string[]> = {
  onClick: ["click"],
  onDoubleClick: ["dblclick"],
  onMouseDown: ["mousedown"],
  onMouseUp: ["mouseup"],
  onMouseMove: ["mousemove"],
  onMouseEnter: ["mouseenter"],
  onMouseLeave: ["mouseleave"],
  onMouseOver: ["mouseover"],
  onMouseOut: ["mouseout"],
  onContextMenu: ["contextmenu"],

  onKeyDown: ["keydown"],
  onKeyUp: ["keyup"],
  onKeyPress: ["keypress"],

  onFocus: ["focusin"],
  onBlur: ["focusout"],

  onChange: ["change", "input"],
  onInput: ["input"],
  onSubmit: ["submit"],
  onReset: ["reset"],
  onInvalid: ["invalid"],

  onScroll: ["scroll"],
  onWheel: ["wheel"],

  onPointerDown: ["pointerdown"],
  onPointerUp: ["pointerup"],
  onPointerMove: ["pointermove"],
  onPointerEnter: ["pointerenter"],
  onPointerLeave: ["pointerleave"],
  onPointerOver: ["pointerover"],
  onPointerOut: ["pointerout"],
  onPointerCancel: ["pointercancel"],
  onGotPointerCapture: ["gotpointercapture"],
  onLostPointerCapture: ["lostpointercapture"],

  onTouchStart: ["touchstart"],
  onTouchEnd: ["touchend"],
  onTouchMove: ["touchmove"],
  onTouchCancel: ["touchcancel"],

  onDrag: ["drag"],
  onDragEnd: ["dragend"],
  onDragEnter: ["dragenter"],
  onDragExit: ["dragexit"],
  onDragLeave: ["dragleave"],
  onDragOver: ["dragover"],
  onDragStart: ["dragstart"],
  onDrop: ["drop"],

  onCopy: ["copy"],
  onCut: ["cut"],
  onPaste: ["paste"],

  onCompositionEnd: ["compositionend"],
  onCompositionStart: ["compositionstart"],
  onCompositionUpdate: ["compositionupdate"],

  onSelect: ["select"],

  onAnimationEnd: ["animationend"],
  onAnimationIteration: ["animationiteration"],
  onAnimationStart: ["animationstart"],

  onTransitionEnd: ["transitionend"],

  onLoad: ["load"],
  onError: ["error"],
  onAbort: ["abort"],

  onBeforeInput: ["beforeinput"],
};

// Native event name -> React event names (reverse lookup)
const NATIVE_TO_REACT: Map<string, string[]> = new Map();

for (const [reactName, nativeEvents] of Object.entries(EVENT_MAP)) {
  for (const nativeEvent of nativeEvents) {
    const existing = NATIVE_TO_REACT.get(nativeEvent) || [];
    existing.push(reactName);
    NATIVE_TO_REACT.set(nativeEvent, existing);
  }
}

// Discrete events get SyncLane priority (user interactions)
const DISCRETE_EVENTS = new Set([
  "click",
  "dblclick",
  "mousedown",
  "mouseup",
  "keydown",
  "keyup",
  "keypress",
  "focusin",
  "focusout",
  "change",
  "input",
  "submit",
  "reset",
  "pointerdown",
  "pointerup",
  "touchstart",
  "touchend",
  "copy",
  "cut",
  "paste",
  "compositionend",
  "compositionstart",
  "compositionupdate",
  "beforeinput",
  "select",
]);

// Non-bubbling events that need capture-phase listening
const NON_BUBBLING_EVENTS = new Set([
  "scroll",
  "load",
  "error",
  "abort",
  "mouseenter",
  "mouseleave",
  "pointerenter",
  "pointerleave",
]);

export function getReactNamesForNativeEvent(nativeEventName: string): string[] {
  return NATIVE_TO_REACT.get(nativeEventName) || [];
}

export function getNativeEventsForReactEvent(reactName: string): string[] {
  return EVENT_MAP[reactName] || [];
}

export function isDiscreteEvent(nativeEventName: string): boolean {
  return DISCRETE_EVENTS.has(nativeEventName);
}

export function isNonBubblingEvent(nativeEventName: string): boolean {
  return NON_BUBBLING_EVENTS.has(nativeEventName);
}

export function getAllNativeEvents(): Set<string> {
  const allEvents = new Set<string>();
  for (const events of Object.values(EVENT_MAP)) {
    for (const event of events) {
      allEvents.add(event);
    }
  }
  return allEvents;
}

export function getReactNameFromPropKey(propKey: string): string | null {
  if (propKey in EVENT_MAP) {
    return propKey;
  }
  // Check for capture variant (e.g., onClickCapture -> onClick)
  if (propKey.endsWith("Capture")) {
    const baseName = propKey.slice(0, -7);
    if (baseName in EVENT_MAP) {
      return baseName;
    }
  }
  return null;
}
