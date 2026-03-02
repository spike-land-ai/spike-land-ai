// Synthetic Event - Pool-free event wrapper for React's event system

export interface SyntheticEventInterface {
  type: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  eventPhase: number;
  bubbles: boolean;
  cancelable: boolean;
  timeStamp: number;
  defaultPrevented: boolean;
  isTrusted: boolean;
  nativeEvent: Event;
  isPropagationStopped(): boolean;
  isDefaultPrevented(): boolean;
  stopPropagation(): void;
  preventDefault(): void;
  persist(): void;
}

export class SyntheticEvent implements SyntheticEventInterface {
  type: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  eventPhase: number;
  bubbles: boolean;
  cancelable: boolean;
  timeStamp: number;
  defaultPrevented: boolean;
  isTrusted: boolean;
  nativeEvent: Event;

  private _propagationStopped: boolean = false;
  private _defaultPrevented: boolean = false;

  constructor(type: string, nativeEvent: Event, target: EventTarget | null) {
    this.type = type;
    this.nativeEvent = nativeEvent;
    this.target = target;
    this.currentTarget = null;
    this.eventPhase = 0;
    this.bubbles = nativeEvent.bubbles;
    this.cancelable = nativeEvent.cancelable;
    this.timeStamp = nativeEvent.timeStamp;
    this.defaultPrevented = nativeEvent.defaultPrevented;
    this.isTrusted = nativeEvent.isTrusted;
    this._defaultPrevented = nativeEvent.defaultPrevented;
  }

  stopPropagation(): void {
    this._propagationStopped = true;
    this.nativeEvent.stopPropagation();
  }

  isPropagationStopped(): boolean {
    return this._propagationStopped;
  }

  preventDefault(): void {
    this._defaultPrevented = true;
    this.defaultPrevented = true;
    this.nativeEvent.preventDefault();
  }

  isDefaultPrevented(): boolean {
    return this._defaultPrevented;
  }

  persist(): void {
    // No-op since we don't pool events
  }
}

// Specialized event types
export class SyntheticMouseEvent extends SyntheticEvent {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  screenX: number;
  screenY: number;
  button: number;
  buttons: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  relatedTarget: EventTarget | null;

  constructor(type: string, nativeEvent: MouseEvent, target: EventTarget | null) {
    super(type, nativeEvent, target);
    this.clientX = nativeEvent.clientX;
    this.clientY = nativeEvent.clientY;
    this.pageX = nativeEvent.pageX;
    this.pageY = nativeEvent.pageY;
    this.screenX = nativeEvent.screenX;
    this.screenY = nativeEvent.screenY;
    this.button = nativeEvent.button;
    this.buttons = nativeEvent.buttons;
    this.ctrlKey = nativeEvent.ctrlKey;
    this.shiftKey = nativeEvent.shiftKey;
    this.altKey = nativeEvent.altKey;
    this.metaKey = nativeEvent.metaKey;
    this.relatedTarget = nativeEvent.relatedTarget;
  }
}

export class SyntheticKeyboardEvent extends SyntheticEvent {
  key: string;
  code: string;
  charCode: number;
  keyCode: number;
  which: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  repeat: boolean;
  locale: string;

  constructor(type: string, nativeEvent: KeyboardEvent, target: EventTarget | null) {
    super(type, nativeEvent, target);
    this.key = nativeEvent.key;
    this.code = nativeEvent.code;
    this.charCode = nativeEvent.charCode;
    this.keyCode = nativeEvent.keyCode;
    this.which = nativeEvent.which;
    this.ctrlKey = nativeEvent.ctrlKey;
    this.shiftKey = nativeEvent.shiftKey;
    this.altKey = nativeEvent.altKey;
    this.metaKey = nativeEvent.metaKey;
    this.repeat = nativeEvent.repeat;
    this.locale = (nativeEvent as unknown as Record<string, string>).locale || "";
  }
}

export class SyntheticFocusEvent extends SyntheticEvent {
  relatedTarget: EventTarget | null;

  constructor(type: string, nativeEvent: FocusEvent, target: EventTarget | null) {
    super(type, nativeEvent, target);
    this.relatedTarget = nativeEvent.relatedTarget;
  }
}

export class SyntheticInputEvent extends SyntheticEvent {
  data: string | null;

  constructor(type: string, nativeEvent: InputEvent | Event, target: EventTarget | null) {
    super(type, nativeEvent, target);
    this.data = (nativeEvent as InputEvent).data ?? null;
  }
}

export function createSyntheticEvent(
  reactName: string,
  nativeEvent: Event,
  target: EventTarget | null,
): SyntheticEvent {
  if (nativeEvent instanceof MouseEvent) {
    return new SyntheticMouseEvent(reactName, nativeEvent, target);
  }
  if (nativeEvent instanceof KeyboardEvent) {
    return new SyntheticKeyboardEvent(reactName, nativeEvent, target);
  }
  if (nativeEvent instanceof FocusEvent) {
    return new SyntheticFocusEvent(reactName, nativeEvent, target);
  }
  if (typeof InputEvent !== "undefined" && nativeEvent instanceof InputEvent) {
    return new SyntheticInputEvent(reactName, nativeEvent, target);
  }
  return new SyntheticEvent(reactName, nativeEvent, target);
}
