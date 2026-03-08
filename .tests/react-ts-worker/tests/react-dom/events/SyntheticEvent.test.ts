import { describe, expect, it } from "vitest";
import {
  createSyntheticEvent,
  SyntheticEvent,
  SyntheticFocusEvent,
  SyntheticInputEvent,
  SyntheticKeyboardEvent,
  SyntheticMouseEvent,
} from "../../../../../src/core/react-engine/react-dom/events/SyntheticEvent.js";

function makeNativeEvent(type: string, opts?: EventInit): Event {
  return new Event(type, { bubbles: true, cancelable: true, ...opts });
}

function makeMouseEvent(type: string, init?: MouseEventInit): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: 10,
    clientY: 20,
    pageX: 30,
    pageY: 40,
    screenX: 50,
    screenY: 60,
    button: 0,
    buttons: 1,
    ctrlKey: true,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    relatedTarget: null,
    ...init,
  });
}

function makeKeyboardEvent(type: string, init?: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: "Enter",
    code: "Enter",
    ctrlKey: false,
    shiftKey: true,
    altKey: false,
    metaKey: false,
    repeat: false,
    ...init,
  });
}

function makeFocusEvent(type: string): FocusEvent {
  return new FocusEvent(type, { bubbles: true, cancelable: false });
}

describe("SyntheticEvent", () => {
  describe("SyntheticEvent base class", () => {
    it("initializes from native event", () => {
      const native = makeNativeEvent("click");
      const target = document.createElement("div");
      const synth = new SyntheticEvent("onClick", native, target);

      expect(synth.type).toBe("onClick");
      expect(synth.nativeEvent).toBe(native);
      expect(synth.target).toBe(target);
      expect(synth.currentTarget).toBeNull();
      expect(synth.bubbles).toBe(true);
      expect(synth.cancelable).toBe(true);
      expect(synth.isTrusted).toBe(false);
    });

    it("isPropagationStopped returns false by default", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);
      expect(synth.isPropagationStopped()).toBe(false);
    });

    it("stopPropagation marks propagation stopped", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);

      synth.stopPropagation();

      expect(synth.isPropagationStopped()).toBe(true);
    });

    it("isDefaultPrevented returns false by default", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);
      expect(synth.isDefaultPrevented()).toBe(false);
    });

    it("preventDefault marks default prevented", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);

      synth.preventDefault();

      expect(synth.isDefaultPrevented()).toBe(true);
      expect(synth.defaultPrevented).toBe(true);
    });

    it("persist is a no-op", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);
      expect(() => synth.persist()).not.toThrow();
    });

    it("timeStamp comes from nativeEvent", () => {
      const native = makeNativeEvent("click");
      const synth = new SyntheticEvent("onClick", native, null);
      expect(synth.timeStamp).toBe(native.timeStamp);
    });
  });

  describe("SyntheticMouseEvent", () => {
    it("copies mouse event properties", () => {
      const native = makeMouseEvent("click");
      const target = document.createElement("div");
      const synth = new SyntheticMouseEvent("onClick", native, target);

      expect(synth.clientX).toBe(10);
      expect(synth.clientY).toBe(20);
      // jsdom may not support pageX/pageY properly - just check types
      expect(typeof synth.pageX).toBe("number");
      expect(typeof synth.pageY).toBe("number");
      expect(typeof synth.screenX).toBe("number");
      expect(typeof synth.screenY).toBe("number");
      expect(synth.button).toBe(0);
      expect(synth.buttons).toBe(1);
      expect(synth.ctrlKey).toBe(true);
      expect(synth.shiftKey).toBe(false);
      expect(synth.altKey).toBe(false);
      expect(synth.metaKey).toBe(false);
      expect(synth.relatedTarget).toBeNull();
    });

    it("extends SyntheticEvent", () => {
      const native = makeMouseEvent("click");
      const synth = new SyntheticMouseEvent("onClick", native, null);
      expect(synth instanceof SyntheticEvent).toBe(true);
    });
  });

  describe("SyntheticKeyboardEvent", () => {
    it("copies keyboard event properties", () => {
      const native = makeKeyboardEvent("keydown");
      const synth = new SyntheticKeyboardEvent("onKeyDown", native, null);

      expect(synth.key).toBe("Enter");
      expect(synth.code).toBe("Enter");
      expect(synth.shiftKey).toBe(true);
      expect(synth.ctrlKey).toBe(false);
      expect(synth.altKey).toBe(false);
      expect(synth.metaKey).toBe(false);
      expect(synth.repeat).toBe(false);
    });

    it("locale defaults to empty string", () => {
      const native = makeKeyboardEvent("keydown");
      const synth = new SyntheticKeyboardEvent("onKeyDown", native, null);
      expect(synth.locale).toBe("");
    });
  });

  describe("SyntheticFocusEvent", () => {
    it("copies relatedTarget", () => {
      const native = makeFocusEvent("focus");
      const synth = new SyntheticFocusEvent("onFocus", native, null);
      expect(synth.relatedTarget).toBeNull();
    });
  });

  describe("SyntheticInputEvent", () => {
    it("creates with null data when not InputEvent", () => {
      const native = makeNativeEvent("change");
      const synth = new SyntheticInputEvent("onChange", native, null);
      expect(synth.data).toBeNull();
    });
  });

  describe("createSyntheticEvent factory", () => {
    it("creates SyntheticMouseEvent for MouseEvent", () => {
      const native = makeMouseEvent("click");
      const synth = createSyntheticEvent("onClick", native, null);
      expect(synth instanceof SyntheticMouseEvent).toBe(true);
    });

    it("creates SyntheticKeyboardEvent for KeyboardEvent", () => {
      const native = makeKeyboardEvent("keydown");
      const synth = createSyntheticEvent("onKeyDown", native, null);
      expect(synth instanceof SyntheticKeyboardEvent).toBe(true);
    });

    it("creates SyntheticFocusEvent for FocusEvent", () => {
      const native = makeFocusEvent("focus");
      const synth = createSyntheticEvent("onFocus", native, null);
      expect(synth instanceof SyntheticFocusEvent).toBe(true);
    });

    it("creates SyntheticInputEvent for InputEvent", () => {
      const native = new InputEvent("input", { bubbles: true, data: "a" });
      const synth = createSyntheticEvent("onInput", native, null);
      expect(synth instanceof SyntheticInputEvent).toBe(true);
    });

    it("creates base SyntheticEvent for generic events", () => {
      const native = makeNativeEvent("scroll");
      const synth = createSyntheticEvent("onScroll", native, null);
      expect(synth instanceof SyntheticEvent).toBe(true);
      expect(synth.constructor).toBe(SyntheticEvent);
    });
  });
});
