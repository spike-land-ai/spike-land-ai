// DOM Host Config - implements HostConfig interface for browser DOM rendering

import type { HostConfig, HostContextValue } from "./HostConfigInterface.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const MATH_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

// Properties that should be set as DOM properties rather than attributes
const PROP_TO_ATTRIBUTE: Record<string, string> = {
  className: "class",
  htmlFor: "for",
  httpEquiv: "http-equiv",
  acceptCharset: "accept-charset",
};

// Boolean attributes
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
  "default",
  "defer",
  "formNoValidate",
  "loop",
  "muted",
  "noModule",
  "noValidate",
  "open",
  "playsInline",
  "reversed",
  "scoped",
  "seamless",
  "allowFullScreen",
  "async",
  "autofocus",
]);

function setInitialProperties(
  domElement: Element,
  _type: string,
  props: Record<string, unknown>,
): void {
  for (const propKey in props) {
    if (!Object.prototype.hasOwnProperty.call(props, propKey)) continue;
    const propValue = props[propKey];
    if (propValue == null) continue;

    if (propKey === "children") {
      if (typeof propValue === "string" || typeof propValue === "number") {
        domElement.textContent = String(propValue);
      }
    } else if (propKey === "style") {
      setStyles(domElement as HTMLElement, propValue as Record<string, unknown>);
    } else if (propKey === "innerHTML") {
      // React's dangerouslySetInnerHTML.__html maps to this
      (domElement as HTMLElement).innerHTML = propValue as string;
    } else if (propKey === "ref" || propKey === "key") {
      // Skip
    } else if (propKey.startsWith("on")) {
      // Event listeners handled by event delegation
    } else {
      setAttribute(domElement, propKey, propValue);
    }
  }
}

function updateProperties(
  domElement: Element,
  _type: string,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  // Remove old props
  for (const propKey in oldProps) {
    if (propKey === "children" || propKey === "key" || propKey === "ref") {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(newProps, propKey)) continue;

    if (propKey === "style") {
      const style = (domElement as HTMLElement).style;
      const oldStyle = oldProps[propKey] as Record<string, unknown> | undefined;
      if (oldStyle) {
        for (const styleName in oldStyle) {
          style.setProperty(styleName, "");
        }
      }
    } else if (propKey.startsWith("on")) {
      // Event cleanup handled by event delegation
    } else {
      domElement.removeAttribute(PROP_TO_ATTRIBUTE[propKey] || propKey);
    }
  }

  // Set new props
  for (const propKey in newProps) {
    if (propKey === "key" || propKey === "ref") continue;
    const newValue = newProps[propKey];
    const oldValue = oldProps[propKey];

    if (newValue === oldValue) continue;

    if (propKey === "children") {
      if (typeof newValue === "string" || typeof newValue === "number") {
        domElement.textContent = String(newValue);
      }
    } else if (propKey === "style") {
      setStyles(
        domElement as HTMLElement,
        newValue as Record<string, unknown>,
        oldProps.style as Record<string, unknown>,
      );
    } else if (propKey.startsWith("on")) {
      // Event listeners handled by event delegation
    } else {
      if (newValue == null) {
        domElement.removeAttribute(PROP_TO_ATTRIBUTE[propKey] || propKey);
      } else {
        setAttribute(domElement, propKey, newValue);
      }
    }
  }
}

function setAttribute(domElement: Element, key: string, value: unknown): void {
  const attrName = PROP_TO_ATTRIBUTE[key] || key;

  if (BOOLEAN_ATTRS.has(key)) {
    if (value) {
      domElement.setAttribute(attrName, "");
    } else {
      domElement.removeAttribute(attrName);
    }
  } else if (key === "value") {
    // Special handling for value property on input/select/textarea
    (domElement as HTMLInputElement).value = value == null ? "" : String(value);
  } else {
    domElement.setAttribute(attrName, String(value));
  }
}

function setStyles(
  element: HTMLElement,
  newStyles: Record<string, unknown>,
  oldStyles?: Record<string, unknown>,
): void {
  const style = element.style;

  // Remove old styles
  if (oldStyles) {
    for (const key in oldStyles) {
      if (!newStyles || !newStyles.hasOwnProperty(key)) {
        if (key.indexOf("-") > -1) {
          style.removeProperty(key);
        } else {
          (style as unknown as Record<string, string>)[key] = "";
        }
      }
    }
  }

  // Set new styles
  if (newStyles) {
    for (const key in newStyles) {
      const value = newStyles[key];
      if (key.indexOf("-") > -1) {
        style.setProperty(key, value == null ? "" : String(value));
      } else {
        (style as unknown as Record<string, string>)[key] = value == null ? "" : String(value);
      }
    }
  }
}

export const DOMHostConfig: HostConfig<
  string,
  Record<string, unknown>,
  Element,
  Element,
  Text,
  HostContextValue,
  boolean
> = {
  supportsMutation: true,
  isPrimaryRenderer: true,

  createInstance(
    type: string,
    props: Record<string, unknown>,
    _rootContainer: Element,
    hostContext: HostContextValue,
  ): Element {
    let domElement: Element;
    if (hostContext.namespace === SVG_NAMESPACE) {
      domElement = document.createElementNS(SVG_NAMESPACE, type);
    } else if (hostContext.namespace === MATH_NAMESPACE) {
      domElement = document.createElementNS(MATH_NAMESPACE, type);
    } else if (props.is) {
      domElement = document.createElement(type, { is: props.is as string });
    } else {
      domElement = document.createElement(type);
    }

    setInitialProperties(domElement, type, props);
    return domElement;
  },

  createTextInstance(text: string, _rootContainer: Element, _hostContext: HostContextValue): Text {
    return document.createTextNode(text);
  },

  appendChild(parent: Element, child: Element | Text): void {
    parent.appendChild(child);
  },

  appendChildToContainer(container: Element, child: Element | Text): void {
    container.appendChild(child);
  },

  appendInitialChild(parent: Element, child: Element | Text): void {
    parent.appendChild(child);
  },

  insertBefore(parent: Element, child: Element | Text, before: Element | Text): void {
    parent.insertBefore(child, before);
  },

  insertInContainerBefore(container: Element, child: Element | Text, before: Element | Text): void {
    container.insertBefore(child, before);
  },

  removeChild(parent: Element, child: Element | Text): void {
    parent.removeChild(child);
  },

  removeChildFromContainer(container: Element, child: Element | Text): void {
    container.removeChild(child);
  },

  commitUpdate(
    instance: Element,
    type: string,
    oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>,
  ): void {
    updateProperties(instance, type, oldProps, newProps);
  },

  commitTextUpdate(textInstance: Text, _oldText: string, newText: string): void {
    textInstance.nodeValue = newText;
  },

  resetTextContent(instance: Element): void {
    instance.textContent = "";
  },

  shouldSetTextContent(type: string, props: Record<string, unknown>): boolean {
    return (
      type === "textarea" ||
      type === "noscript" ||
      typeof props.children === "string" ||
      typeof props.children === "number" ||
      typeof props.children === "bigint"
    );
  },

  getRootHostContext(_rootContainer: Element): HostContextValue {
    return { namespace: "" };
  },

  getChildHostContext(parentHostContext: HostContextValue, type: string): HostContextValue {
    if (type === "svg") {
      return { namespace: SVG_NAMESPACE };
    }
    if (type === "math") {
      return { namespace: MATH_NAMESPACE };
    }
    if (parentHostContext.namespace === SVG_NAMESPACE && type === "foreignObject") {
      return { namespace: "" };
    }
    return parentHostContext;
  },

  prepareForCommit(_container: Element): Record<string, unknown> | null {
    return null;
  },

  resetAfterCommit(_container: Element): void {},

  finalizeInitialChildren(
    _instance: Element,
    _type: string,
    props: Record<string, unknown>,
    _hostContext: HostContextValue,
  ): boolean {
    return !!props.autoFocus;
  },

  prepareUpdate(
    _instance: Element,
    _type: string,
    oldProps: Record<string, unknown>,
    newProps: Record<string, unknown>,
    _hostContext: HostContextValue,
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

  clearContainer(container: Element): void {
    container.textContent = "";
  },

  getCurrentTime(): number {
    return performance.now();
  },

  scheduleMicrotask(fn: () => void): void {
    queueMicrotask(fn);
  },
};

export default DOMHostConfig;
