import type {
  DependencyList,
  Dispatch,
  Dispatcher,
  ReactContext,
  Ref,
  RefObject,
  SetStateAction,
  Usable,
} from "./ReactTypes.js";
import ReactSharedInternals from "./ReactSharedInternals.js";

function resolveDispatcher(): Dispatcher {
  const dispatcher = ReactSharedInternals.H;
  return dispatcher as Dispatcher;
}

export function useState<S>(initialState: (() => S) | S): [S, Dispatch<SetStateAction<S>>] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useState(initialState);
}

export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
  init?: undefined,
): [S, Dispatch<A>];
export function useReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init: (arg: I) => S,
): [S, Dispatch<A>];
export function useReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S,
): [S, Dispatch<A>] {
  const dispatcher = resolveDispatcher();
  return (
    dispatcher as unknown as {
      useReducer: (
        reducer: (state: S, action: A) => S,
        initialArg: I,
        init?: (arg: I) => S,
      ) => [S, Dispatch<A>];
    }
  ).useReducer(reducer, initialArg, init);
}

export function useEffect(create: () => (() => void) | void, deps?: DependencyList): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useEffect(create, deps);
}

export function useLayoutEffect(create: () => (() => void) | void, deps?: DependencyList): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useLayoutEffect(create, deps);
}

export function useInsertionEffect(create: () => (() => void) | void, deps?: DependencyList): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useInsertionEffect(create, deps);
}

export function useCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: DependencyList,
): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useCallback(callback, deps);
}

export function useMemo<T>(create: () => T, deps: DependencyList): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useMemo(create, deps);
}

export function useRef<T>(initialValue: T): RefObject<T> {
  const dispatcher = resolveDispatcher();
  return dispatcher.useRef(initialValue);
}

export function useContext<T>(context: ReactContext<T>): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useContext(context);
}

export function useImperativeHandle<T>(
  ref: Ref<T> | undefined,
  create: () => T,
  deps?: DependencyList,
): void {
  const dispatcher = resolveDispatcher();
  return dispatcher.useImperativeHandle(ref, create, deps);
}

export function useDebugValue<T>(_value: T, _format?: (value: T) => unknown): void {
  // useDebugValue is a no-op in production
}

export function useTransition(): [boolean, (callback: () => void) => void] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useTransition();
}

export function useDeferredValue<T>(value: T, initialValue?: T): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useDeferredValue(value, initialValue);
}

export function useId(): string {
  const dispatcher = resolveDispatcher();
  return dispatcher.useId();
}

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function use<T>(usable: Usable<T>): T {
  const dispatcher = resolveDispatcher();
  return dispatcher.use(usable);
}

export function useOptimistic<S, A>(
  passthrough: S,
  reducer?: (state: S, action: A) => S,
): [S, (action: A) => void] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useOptimistic(passthrough, reducer);
}

export function useActionState<S, P>(
  action: (state: Awaited<S>, payload: P) => S,
  initialState: Awaited<S>,
  permalink?: string,
): [Awaited<S>, (payload: P) => void, boolean] {
  const dispatcher = resolveDispatcher();
  return dispatcher.useActionState(action, initialState, permalink);
}
