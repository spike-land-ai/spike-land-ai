// Server-side Hook Dispatcher for Fizz
// Provides hook implementations that work during SSR

import type {
  DependencyList,
  Dispatcher,
  ReactContext,
  RefObject,
  Usable,
} from "../react/ReactTypes.js";
import { REACT_CONTEXT_TYPE } from "../react/ReactSymbols.js";

let idCounter = 0;

export function resetIdCounter(): void {
  idCounter = 0;
}

function generateId(): string {
  return ":r" + (idCounter++).toString(32) + ":";
}

// The server dispatcher provides simplified hook implementations
export const ServerDispatcher: Dispatcher = {
  useState<S>(initialState: (() => S) | S): [S, (action: S | ((prev: S) => S)) => void] {
    const state = typeof initialState === "function" ? (initialState as () => S)() : initialState;
    return [state, () => {}];
  },

  useReducer<S, A>(
    _reducer: (state: S, action: A) => S,
    initialArg: S,
    init?: (arg: S) => S,
  ): [S, (action: A) => void] {
    const state = init ? init(initialArg) : initialArg;
    return [state, () => {}];
  },

  useEffect(_create: () => (() => void) | void, _deps?: DependencyList): void {
    // No-op on server
  },

  useLayoutEffect(_create: () => (() => void) | void, _deps?: DependencyList): void {
    // No-op on server
  },

  useInsertionEffect(_create: () => (() => void) | void, _deps?: DependencyList): void {
    // No-op on server
  },

  useCallback<T extends (...args: unknown[]) => unknown>(callback: T, _deps: DependencyList): T {
    return callback;
  },

  useMemo<T>(create: () => T, _deps: DependencyList): T {
    return create();
  },

  useRef<T>(initialValue: T): RefObject<T> {
    return { current: initialValue };
  },

  useContext<T>(context: ReactContext<T>): T {
    return context._currentValue;
  },

  useImperativeHandle<T>(_ref: unknown, _create: () => T, _deps?: DependencyList): void {
    // No-op on server
  },

  useDebugValue<T>(_value: T, _format?: (value: T) => unknown): void {
    // No-op on server
  },

  useTransition(): [boolean, (callback: () => void) => void] {
    return [false, (callback: () => void) => callback()];
  },

  useDeferredValue<T>(value: T, _initialValue?: T): T {
    return value;
  },

  useId(): string {
    return generateId();
  },

  useSyncExternalStore<T>(
    _subscribe: (onStoreChange: () => void) => () => void,
    _getSnapshot: () => T,
    getServerSnapshot?: () => T,
  ): T {
    if (getServerSnapshot) {
      return getServerSnapshot();
    }
    throw new Error("useSyncExternalStore requires getServerSnapshot for server rendering.");
  },

  use<T>(usable: Usable<T>): T {
    if (usable !== null && typeof usable === "object") {
      if (
        "$$typeof" in usable &&
        (usable as unknown as Record<string, unknown>).$$typeof === REACT_CONTEXT_TYPE
      ) {
        const context = usable as ReactContext<T>;
        return context._currentValue;
      }
    }
    throw new Error("use() with promises is not supported in server rendering without Suspense.");
  },

  useOptimistic<S, A>(
    passthrough: S,
    _reducer?: (state: S, action: A) => S,
  ): [S, (action: A) => void] {
    return [passthrough, () => {}];
  },

  useActionState<S, P>(
    _action: (state: Awaited<S>, payload: P) => S,
    initialState: Awaited<S>,
    _permalink?: string,
  ): [Awaited<S>, (payload: P) => void, boolean] {
    return [initialState, () => {}, false];
  },
};
