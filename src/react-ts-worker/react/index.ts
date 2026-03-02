// React Public API
export {
  cloneAndReplaceKey,
  cloneElement,
  createElement,
  isValidElement,
} from "./ReactElement.js";
export { jsx, jsxs } from "./jsx-runtime.js";
export { Component, PureComponent } from "./ReactBaseClasses.js";
export { createContext } from "./ReactContext.js";
export { memo } from "./ReactMemo.js";
export { forwardRef } from "./ReactForwardRef.js";
export { lazy } from "./ReactLazy.js";

// Hooks
export {
  use,
  useActionState,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "./ReactHooks.js";

// Children utilities
import {
  countChildren,
  forEachChildren,
  mapChildren,
  onlyChild,
  toArray,
} from "./ReactChildren.js";

export const Children = {
  map: mapChildren,
  forEach: forEachChildren,
  count: countChildren,
  toArray,
  only: onlyChild,
};

// Symbols as component types
export {
  REACT_FRAGMENT_TYPE as Fragment,
  REACT_PROFILER_TYPE as Profiler,
  REACT_STRICT_MODE_TYPE as StrictMode,
  REACT_SUSPENSE_TYPE as Suspense,
} from "./ReactSymbols.js";

// Types
export type {
  ComponentClass,
  FunctionComponent,
  ReactContext,
  ReactElement,
  ReactNode,
  Ref,
  RefCallback,
  RefObject,
} from "./ReactTypes.js";
