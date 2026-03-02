// Symbol tags for React element types
export const REACT_ELEMENT_TYPE: symbol = Symbol.for("react.transitional.element");
export const REACT_PORTAL_TYPE: symbol = Symbol.for("react.portal");
export const REACT_FRAGMENT_TYPE: symbol = Symbol.for("react.fragment");
export const REACT_STRICT_MODE_TYPE: symbol = Symbol.for("react.strict_mode");
export const REACT_PROFILER_TYPE: symbol = Symbol.for("react.profiler");
export const REACT_CONSUMER_TYPE: symbol = Symbol.for("react.consumer");
export const REACT_CONTEXT_TYPE: symbol = Symbol.for("react.context");
export const REACT_FORWARD_REF_TYPE: symbol = Symbol.for("react.forward_ref");
export const REACT_SUSPENSE_TYPE: symbol = Symbol.for("react.suspense");
export const REACT_MEMO_TYPE: symbol = Symbol.for("react.memo");
export const REACT_LAZY_TYPE: symbol = Symbol.for("react.lazy");

export function getIteratorFn(maybeIterable: unknown): (() => Iterator<unknown>) | null {
  if (maybeIterable === null || typeof maybeIterable !== "object") {
    return null;
  }
  const iterableObj = maybeIterable as Record<string | symbol, unknown>;
  const maybeIterator =
    (Symbol.iterator && iterableObj[Symbol.iterator]) || iterableObj["@@iterator"];
  if (typeof maybeIterator === "function") {
    return maybeIterator as () => Iterator<unknown>;
  }
  return null;
}
