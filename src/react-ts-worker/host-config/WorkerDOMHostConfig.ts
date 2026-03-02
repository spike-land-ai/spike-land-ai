// Worker-DOM Host Config
// Uses worker-dom's Document/Element/Text classes directly.
// Worker-dom auto-batches mutations via MutationTransfer.transfer() -> postMessage to main thread.

import type { HostConfig } from "./HostConfigInterface.js";
import type { WorkerEventRegistry } from "../react-worker-dom/bridge/worker-events.js";

// Worker-dom types (these come from the worker-dom library)
export interface WorkerDocument {
  createElement(type: string): WorkerElement;
  createElementNS(namespace: string, type: string): WorkerElement;
  createTextNode(text: string): WorkerText;
}

export interface WorkerNode {
  appendChild(child: WorkerNode): void;
  insertBefore(child: WorkerNode, before: WorkerNode): void;
  removeChild(child: WorkerNode): void;
  textContent: string | null;
  parentNode: WorkerNode | null;
  childNodes: ArrayLike<WorkerNode>;
}

export interface WorkerElement extends WorkerNode {
  tagName: string;
  namespaceURI: string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  style: Record<string, string>;
}

export interface WorkerText extends WorkerNode {
  data: string;
  nodeValue: string | null;
}

interface WorkerHostContext {
  namespace: string;
}

const PROP_TO_ATTRIBUTE: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  httpEquiv: "http-equiv",
  acceptCharset: "accept-charset",
};

const BOOLEAN_ATTRS = new Set([
  "checked",
  "disabled",
  "hidden",
  "multiple",
  "readOnly",
  "required",
  "selected",
  "autoFocus",
  "autoPlay",
  "controls",
]);

function setWorkerProps(
  element: WorkerElement,
  props: Record<string, unknown>,
  eventRegistry?: WorkerEventRegistry,
): void {
  for (const key in props) {
    if (!Object.prototype.hasOwnProperty.call(props, key)) continue;
    const value = props[key];
    if (value == null || key === "children" || key === "key" || key === "ref") {
      continue;
    }

    if (key === "style") {
      if (typeof value === "object" && value !== null) {
        const styleObj = value as Record<string, unknown>;
        for (const styleProp in styleObj) {
          element.style[styleProp] = styleObj[styleProp] == null ? "" : String(styleObj[styleProp]);
        }
      }
    } else if (key.startsWith("on")) {
      // Register event handler with the worker event bridge
      if (typeof value === "function" && eventRegistry && "__nodeId" in element) {
        eventRegistry.setHandler(
          (element as WorkerElement & { __nodeId: number }).__nodeId,
          key,
          value as (event: unknown) => void,
        );
      }
    } else {
      const attrName = PROP_TO_ATTRIBUTE[key] || key;
      if (BOOLEAN_ATTRS.has(key)) {
        if (value) {
          element.setAttribute(attrName, "");
        } else {
          element.removeAttribute(attrName);
        }
      } else {
        element.setAttribute(attrName, String(value));
      }
    }
  }
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MATH_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

export function createWorkerDOMHostConfig(
  workerDocument: WorkerDocument,
  eventRegistry?: WorkerEventRegistry,
): HostConfig<
  string,
  Record<string, unknown>,
  WorkerElement,
  WorkerElement,
  WorkerText,
  WorkerHostContext,
  boolean
> {
  return {
    supportsMutation: true,
    isPrimaryRenderer: true,

    createInstance(
      type: string,
      props: Record<string, unknown>,
      _rootContainer: WorkerElement,
      hostContext: WorkerHostContext,
    ): WorkerElement {
      let element: WorkerElement;
      if (hostContext.namespace === SVG_NAMESPACE) {
        element = workerDocument.createElementNS(SVG_NAMESPACE, type);
      } else if (hostContext.namespace === MATH_NAMESPACE) {
        element = workerDocument.createElementNS(MATH_NAMESPACE, type);
      } else {
        element = workerDocument.createElement(type);
      }
      setWorkerProps(element, props, eventRegistry);
      return element;
    },

    createTextInstance(
      text: string,
      _rootContainer: WorkerElement,
      _hostContext: WorkerHostContext,
    ): WorkerText {
      return workerDocument.createTextNode(text);
    },

    appendChild(parent: WorkerElement, child: WorkerElement | WorkerText): void {
      parent.appendChild(child);
    },

    appendChildToContainer(container: WorkerElement, child: WorkerElement | WorkerText): void {
      container.appendChild(child);
    },

    appendInitialChild(parent: WorkerElement, child: WorkerElement | WorkerText): void {
      parent.appendChild(child);
    },

    insertBefore(
      parent: WorkerElement,
      child: WorkerElement | WorkerText,
      before: WorkerElement | WorkerText,
    ): void {
      parent.insertBefore(child, before);
    },

    insertInContainerBefore(
      container: WorkerElement,
      child: WorkerElement | WorkerText,
      before: WorkerElement | WorkerText,
    ): void {
      container.insertBefore(child, before);
    },

    removeChild(parent: WorkerElement, child: WorkerElement | WorkerText): void {
      parent.removeChild(child);
    },

    removeChildFromContainer(container: WorkerElement, child: WorkerElement | WorkerText): void {
      container.removeChild(child);
    },

    commitUpdate(
      instance: WorkerElement,
      _type: string,
      oldProps: Record<string, unknown>,
      newProps: Record<string, unknown>,
    ): void {
      for (const key in oldProps) {
        if (key === "children" || key === "key" || key === "ref") continue;
        if (Object.prototype.hasOwnProperty.call(newProps, key)) continue;
        if (key.startsWith("on")) {
          // Remove old event handler
          if (eventRegistry && "__nodeId" in instance) {
            eventRegistry.removeHandler(
              (instance as WorkerElement & { __nodeId: number }).__nodeId,
              key,
            );
          }
          continue;
        }
        const attrName = PROP_TO_ATTRIBUTE[key] || key;
        instance.removeAttribute(attrName);
      }
      setWorkerProps(instance, newProps, eventRegistry);
    },

    commitTextUpdate(textInstance: WorkerText, _oldText: string, newText: string): void {
      textInstance.data = newText;
    },

    resetTextContent(instance: WorkerElement): void {
      instance.textContent = "";
    },

    shouldSetTextContent(_type: string, props: Record<string, unknown>): boolean {
      return typeof props.children === "string" || typeof props.children === "number";
    },

    getRootHostContext(_rootContainer: WorkerElement): WorkerHostContext {
      return { namespace: "" };
    },

    getChildHostContext(parentHostContext: WorkerHostContext, type: string): WorkerHostContext {
      if (type === "svg") return { namespace: SVG_NAMESPACE };
      if (type === "math") return { namespace: MATH_NAMESPACE };
      if (parentHostContext.namespace === SVG_NAMESPACE && type === "foreignObject") {
        return { namespace: "" };
      }
      return parentHostContext;
    },

    prepareForCommit(): null {
      return null;
    },

    resetAfterCommit(): void {
      // Worker-dom auto-flushes mutations via microtask
    },

    finalizeInitialChildren(): boolean {
      return false;
    },

    prepareUpdate(
      _instance: WorkerElement,
      _type: string,
      oldProps: Record<string, unknown>,
      newProps: Record<string, unknown>,
    ): boolean | null {
      for (const key in oldProps) {
        if (key === "children" || key === "key" || key === "ref") continue;
        if (oldProps[key] !== newProps[key]) return true;
      }
      for (const key in newProps) {
        if (key === "children" || key === "key" || key === "ref") continue;
        if (!(key in oldProps)) return true;
      }
      return null;
    },

    clearContainer(container: WorkerElement): void {
      container.textContent = "";
    },

    getCurrentTime(): number {
      return performance.now();
    },

    scheduleMicrotask(fn: () => void): void {
      queueMicrotask(fn);
    },
  };
}

export default createWorkerDOMHostConfig;
