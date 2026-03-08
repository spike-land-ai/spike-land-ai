import { describe, expect, it, vi } from "vitest";
import { createWorkerDOMHostConfig } from "../../../../src/core/react-engine/host-config/WorkerDOMHostConfig.js";
import type {
  WorkerDocument,
  WorkerElement,
  WorkerText,
} from "../../../../src/core/react-engine/host-config/WorkerDOMHostConfig.js";

function makeWorkerText(text: string): WorkerText {
  return {
    data: text,
    nodeValue: text,
    textContent: text,
    parentNode: null,
    childNodes: [],
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
  } as unknown as WorkerText;
}

function makeWorkerElement(tag: string): WorkerElement & { __nodeId?: number } {
  const el: WorkerElement & { __nodeId?: number } = {
    tagName: tag.toUpperCase(),
    namespaceURI: null,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    style: {},
    textContent: null,
    parentNode: null,
    childNodes: [],
    appendChild: vi.fn(),
    insertBefore: vi.fn(),
    removeChild: vi.fn(),
  };
  return el;
}

function makeWorkerDocument(): WorkerDocument {
  return {
    createElement: (type: string) => makeWorkerElement(type),
    createElementNS: (ns: string, type: string) => {
      const el = makeWorkerElement(type);
      (el as unknown as Record<string, unknown>).namespaceURI = ns;
      return el;
    },
    createTextNode: (text: string) => makeWorkerText(text),
  };
}

describe("createWorkerDOMHostConfig", () => {
  const doc = makeWorkerDocument();
  const config = createWorkerDOMHostConfig(doc);

  const rootCtx = config.getRootHostContext(makeWorkerElement("div"));
  const rootContainer = makeWorkerElement("div");

  describe("createInstance", () => {
    it("creates element via createElement", () => {
      const el = config.createInstance("div", {}, rootContainer, rootCtx);
      expect(el).toBeDefined();
    });

    it("creates SVG element via createElementNS in SVG context", () => {
      const svgCtx = config.getChildHostContext(rootCtx, "svg");
      const el = config.createInstance("circle", {}, rootContainer, svgCtx);
      expect(el).toBeDefined();
    });

    it("creates math element via createElementNS in math context", () => {
      const mathCtx = config.getChildHostContext(rootCtx, "math");
      const el = config.createInstance("mfrac", {}, rootContainer, mathCtx);
      expect(el).toBeDefined();
    });

    it("sets className via class attribute", () => {
      const el = makeWorkerElement("div");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("div", { className: "foo" }, rootContainer, rootCtx);
      expect(el.setAttribute).toHaveBeenCalledWith("class", "foo");
    });

    it("sets htmlFor as for attribute", () => {
      const el = makeWorkerElement("label");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("label", { htmlFor: "input1" }, rootContainer, rootCtx);
      expect(el.setAttribute).toHaveBeenCalledWith("for", "input1");
    });

    it("sets boolean attribute as empty string when true", () => {
      const el = makeWorkerElement("input");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("input", { disabled: true }, rootContainer, rootCtx);
      expect(el.setAttribute).toHaveBeenCalledWith("disabled", "");
    });

    it("removes boolean attribute when false", () => {
      const el = makeWorkerElement("input");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("input", { disabled: false }, rootContainer, rootCtx);
      expect(el.removeAttribute).toHaveBeenCalledWith("disabled");
    });

    it("sets style properties", () => {
      const el = makeWorkerElement("div");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("div", { style: { color: "red" } }, rootContainer, rootCtx);
      expect(el.style["color"]).toBe("red");
    });

    it("handles event handler with eventRegistry and nodeId", () => {
      const el = makeWorkerElement("div");
      el.__nodeId = 5;
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const registry = { setHandler: vi.fn(), removeHandler: vi.fn(), dispatch: vi.fn() };
      const cfg = createWorkerDOMHostConfig(
        docMock,
        registry as unknown as Parameters<typeof createWorkerDOMHostConfig>[1],
      );
      const handler = () => {};
      cfg.createInstance("div", { onClick: handler }, rootContainer, rootCtx);
      expect(registry.setHandler).toHaveBeenCalledWith(5, "onClick", handler);
    });

    it("ignores null/undefined prop values", () => {
      const el = makeWorkerElement("div");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("div", { title: null, id: undefined }, rootContainer, rootCtx);
      expect(el.setAttribute).not.toHaveBeenCalled();
    });

    it("skips children, key, ref props", () => {
      const el = makeWorkerElement("div");
      const docMock: WorkerDocument = {
        createElement: () => el,
        createElementNS: () => el,
        createTextNode: makeWorkerText,
      };
      const cfg = createWorkerDOMHostConfig(docMock);
      cfg.createInstance("div", { children: "text", key: "k", ref: null }, rootContainer, rootCtx);
      expect(el.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe("createTextInstance", () => {
    it("creates text node", () => {
      const text = config.createTextInstance("hello", rootContainer, rootCtx);
      expect(text).toBeDefined();
    });
  });

  describe("DOM manipulation methods", () => {
    it("appendChild calls parent.appendChild", () => {
      const parent = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      config.appendChild(parent, child);
      expect(parent.appendChild).toHaveBeenCalledWith(child);
    });

    it("appendChildToContainer calls container.appendChild", () => {
      const container = makeWorkerElement("div");
      const child = makeWorkerElement("p");
      config.appendChildToContainer(container, child);
      expect(container.appendChild).toHaveBeenCalledWith(child);
    });

    it("appendInitialChild calls parent.appendChild", () => {
      const parent = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      config.appendInitialChild(parent, child);
      expect(parent.appendChild).toHaveBeenCalledWith(child);
    });

    it("insertBefore calls parent.insertBefore", () => {
      const parent = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      const before = makeWorkerElement("div");
      config.insertBefore(parent, child, before);
      expect(parent.insertBefore).toHaveBeenCalledWith(child, before);
    });

    it("insertInContainerBefore calls container.insertBefore", () => {
      const container = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      const before = makeWorkerElement("div");
      config.insertInContainerBefore(container, child, before);
      expect(container.insertBefore).toHaveBeenCalledWith(child, before);
    });

    it("removeChild calls parent.removeChild", () => {
      const parent = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      config.removeChild(parent, child);
      expect(parent.removeChild).toHaveBeenCalledWith(child);
    });

    it("removeChildFromContainer calls container.removeChild", () => {
      const container = makeWorkerElement("div");
      const child = makeWorkerElement("span");
      config.removeChildFromContainer(container, child);
      expect(container.removeChild).toHaveBeenCalledWith(child);
    });
  });

  describe("commitUpdate", () => {
    it("removes old attributes not in newProps", () => {
      const el = makeWorkerElement("div");
      config.commitUpdate(el, "div", { title: "old", "data-x": "x" }, { "data-x": "x" });
      expect(el.removeAttribute).toHaveBeenCalledWith("title");
    });

    it("sets new props", () => {
      const el = makeWorkerElement("div");
      config.commitUpdate(el, "div", {}, { "data-new": "val" });
      expect(el.setAttribute).toHaveBeenCalledWith("data-new", "val");
    });

    it("removes event handler via eventRegistry on commitUpdate", () => {
      const el = makeWorkerElement("div");
      el.__nodeId = 10;
      const registry = { setHandler: vi.fn(), removeHandler: vi.fn(), dispatch: vi.fn() };
      const cfg = createWorkerDOMHostConfig(
        doc,
        registry as unknown as Parameters<typeof createWorkerDOMHostConfig>[1],
      );
      const oldHandler = () => {};
      cfg.commitUpdate(el, "div", { onClick: oldHandler }, {});
      expect(registry.removeHandler).toHaveBeenCalledWith(10, "onClick");
    });
  });

  describe("commitTextUpdate", () => {
    it("updates text data", () => {
      const text = makeWorkerText("old");
      config.commitTextUpdate(text, "old", "new");
      expect(text.data).toBe("new");
    });
  });

  describe("resetTextContent", () => {
    it("clears text content", () => {
      const el = makeWorkerElement("div");
      config.resetTextContent(el);
      expect(el.textContent).toBe("");
    });
  });

  describe("shouldSetTextContent", () => {
    it("returns true for string children", () => {
      expect(config.shouldSetTextContent("div", { children: "text" })).toBe(true);
    });

    it("returns true for number children", () => {
      expect(config.shouldSetTextContent("div", { children: 42 })).toBe(true);
    });

    it("returns false for object children", () => {
      expect(config.shouldSetTextContent("div", { children: {} })).toBe(false);
    });
  });

  describe("getRootHostContext", () => {
    it("returns context with empty namespace", () => {
      const ctx = config.getRootHostContext(rootContainer);
      expect((ctx as Record<string, unknown>).namespace).toBe("");
    });
  });

  describe("getChildHostContext", () => {
    it("returns SVG namespace for svg type", () => {
      const ctx = config.getChildHostContext(rootCtx, "svg");
      expect((ctx as Record<string, unknown>).namespace).toBe("http://www.w3.org/2000/svg");
    });

    it("returns math namespace for math type", () => {
      const ctx = config.getChildHostContext(rootCtx, "math");
      expect((ctx as Record<string, unknown>).namespace).toBe("http://www.w3.org/1998/Math/MathML");
    });

    it("returns empty namespace for foreignObject inside svg", () => {
      const svgCtx = config.getChildHostContext(rootCtx, "svg");
      const ctx = config.getChildHostContext(svgCtx, "foreignObject");
      expect((ctx as Record<string, unknown>).namespace).toBe("");
    });

    it("returns parent context for regular elements", () => {
      const ctx = config.getChildHostContext(rootCtx, "div");
      expect(ctx).toBe(rootCtx);
    });
  });

  describe("utility methods", () => {
    it("prepareForCommit returns null", () => {
      expect(config.prepareForCommit(rootContainer)).toBeNull();
    });

    it("resetAfterCommit does not throw", () => {
      expect(() => config.resetAfterCommit(rootContainer)).not.toThrow();
    });

    it("finalizeInitialChildren returns false", () => {
      expect(
        config.finalizeInitialChildren(makeWorkerElement("div"), "div", {}, rootContainer, rootCtx),
      ).toBe(false);
    });

    it("prepareUpdate returns true when props differ", () => {
      const el = makeWorkerElement("div");
      expect(config.prepareUpdate(el, "div", { x: 1 }, { x: 2 })).toBe(true);
    });

    it("prepareUpdate returns true when new key added", () => {
      const el = makeWorkerElement("div");
      expect(config.prepareUpdate(el, "div", {}, { x: 1 })).toBe(true);
    });

    it("prepareUpdate returns null when no changes (skips children/key/ref)", () => {
      const el = makeWorkerElement("div");
      expect(
        config.prepareUpdate(
          el,
          "div",
          { children: "a", key: "k", ref: null },
          { children: "b", key: "k2", ref: {} },
        ),
      ).toBeNull();
    });

    it("clearContainer sets textContent to empty", () => {
      const container2 = makeWorkerElement("div");
      config.clearContainer(container2);
      expect(container2.textContent).toBe("");
    });

    it("getCurrentTime returns a number", () => {
      expect(typeof config.getCurrentTime()).toBe("number");
    });

    it("scheduleMicrotask schedules a callback", async () => {
      let called = false;
      config.scheduleMicrotask(() => {
        called = true;
      });
      await new Promise<void>((r) => queueMicrotask(r));
      expect(called).toBe(true);
    });
  });
});

describe("createWorkerDOMHostConfig - worker root", () => {
  it("creates a WorkerRoot and renders", async () => {
    const _mutations: unknown[] = [];

    const mockDoc: WorkerDocument = {
      createElement: (type: string) => {
        const el = makeWorkerElement(type);
        return el;
      },
      createElementNS: (_ns: string, type: string) => makeWorkerElement(type),
      createTextNode: (text: string) => makeWorkerText(text),
    };

    const { createRoot } = await import(
      "../../../../src/core/react-engine/react-worker-dom/index.js"
    );
    const { createElement } = await import("../../../../src/core/react-engine/react/index.js");

    const container = makeWorkerElement("div");
    const root = createRoot(mockDoc, container);

    expect(typeof root.render).toBe("function");
    expect(typeof root.unmount).toBe("function");

    // render should not throw
    expect(() => root.render(createElement("div", null, "worker content"))).not.toThrow();
    await new Promise<void>((r) => queueMicrotask(r));
    await new Promise<void>((r) => queueMicrotask(r));
  });
});
