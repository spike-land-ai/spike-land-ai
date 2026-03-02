import type {
  Effect,
  Fiber,
  FiberRoot,
  FunctionComponentUpdateQueue,
  Hook,
  Update,
  UpdateQueue,
} from "./ReactFiberTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import type { Dispatcher, ReactContext } from "../react/ReactTypes.js";
import type { Flags } from "./ReactFiberFlags.js";
import {
  includesOnlyNonUrgentLanes,
  isSubsetOfLanes,
  mergeLanes,
  NoLane,
  NoLanes,
  removeLanes,
  SyncLane,
} from "./ReactFiberLane.js";
import {
  LayoutStatic as LayoutStaticEffect,
  Passive as PassiveEffect,
  PassiveStatic as PassiveStaticEffect,
  Update as UpdateEffect,
} from "./ReactFiberFlags.js";
import ReactSharedInternals from "../react/ReactSharedInternals.js";
import { REACT_CONTEXT_TYPE } from "../react/ReactSymbols.js";
import { prepareToReadContext, readContext } from "./ReactFiberNewContext.js";
import objectIs from "../shared/objectIs.js";
import { HostRoot } from "./ReactWorkTags.js";

// --- Hook Effect Tags ---
export const HookHasEffect = /*  */ 0b0001;
export const HookInsertion = /*  */ 0b0010;
export const HookLayout = /*  */ 0b0100;
export const HookPassive = /*  */ 0b1000;

// --- Effect Instance ---
interface EffectInstance {
  destroy: void | (() => void);
}

// --- Module-level state ---
let renderLanes: Lanes = NoLanes;
let currentlyRenderingFiber: Fiber = null as unknown as Fiber;
let currentHook: Hook | null = null;
let workInProgressHook: Hook | null = null;
let didScheduleRenderPhaseUpdateDuringThisPass: boolean = false;
let globalClientIdCounter: number = 0;

const RE_RENDER_LIMIT = 25;

// --- Exported functions for work loop interaction ---
// These will be set by the work loop to avoid circular dependencies
let scheduleUpdateOnFiberFn: ((root: FiberRoot, fiber: Fiber, lane: Lane) => void) | null = null;
let requestUpdateLaneFn: (() => Lane) | null = null;
let workInProgressRoot: FiberRoot | null = null;
let markWorkInProgressReceivedUpdateFn: (() => void) | null = null;

export function setHooksExternals(externals: {
  scheduleUpdateOnFiber: (root: FiberRoot, fiber: Fiber, lane: Lane) => void;
  requestUpdateLane: () => Lane;
  markWorkInProgressReceivedUpdate: () => void;
}): void {
  scheduleUpdateOnFiberFn = externals.scheduleUpdateOnFiber;
  requestUpdateLaneFn = externals.requestUpdateLane;
  markWorkInProgressReceivedUpdateFn = externals.markWorkInProgressReceivedUpdate;
}

export function setWorkInProgressRoot(root: FiberRoot | null, _lanes: Lanes): void {
  workInProgressRoot = root;
}

// --- Helper functions ---

function basicStateReducer<S>(state: S, action: S | ((s: S) => S)): S {
  return typeof action === "function" ? (action as (s: S) => S)(state) : action;
}

function areHookInputsEqual(nextDeps: Array<unknown>, prevDeps: Array<unknown> | null): boolean {
  if (prevDeps === null) {
    return false;
  }
  if (prevDeps.length !== nextDeps.length) {
    return false;
  }
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (objectIs(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}

function createEffectInstance(): EffectInstance {
  return { destroy: undefined };
}

function createFunctionComponentUpdateQueue(): FunctionComponentUpdateQueue {
  return {
    lastEffect: null,
    events: null,
    stores: null,
  };
}

// --- Hook infrastructure ---

function mountWorkInProgressHook(): Hook {
  const hook: Hook = {
    memoizedState: null,
    baseState: null,
    baseQueue: null,
    queue: null,
    next: null,
  };

  if (workInProgressHook === null) {
    currentlyRenderingFiber.memoizedState = workInProgressHook = hook;
  } else {
    workInProgressHook = workInProgressHook.next = hook;
  }
  return workInProgressHook;
}

function updateWorkInProgressHook(): Hook {
  let nextCurrentHook: Hook | null;
  if (currentHook === null) {
    const current = currentlyRenderingFiber.alternate;
    if (current !== null) {
      nextCurrentHook = current.memoizedState as Hook | null;
    } else {
      nextCurrentHook = null;
    }
  } else {
    nextCurrentHook = currentHook.next;
  }

  let nextWorkInProgressHook: Hook | null;
  if (workInProgressHook === null) {
    nextWorkInProgressHook = currentlyRenderingFiber.memoizedState as Hook | null;
  } else {
    nextWorkInProgressHook = workInProgressHook.next;
  }

  if (nextWorkInProgressHook !== null) {
    // Reuse existing work-in-progress hook
    workInProgressHook = nextWorkInProgressHook;
    nextWorkInProgressHook = workInProgressHook.next;
    currentHook = nextCurrentHook;
  } else {
    // Clone from current hook
    if (nextCurrentHook === null) {
      throw new Error("Rendered more hooks than during the previous render.");
    }

    currentHook = nextCurrentHook;

    const newHook: Hook = {
      memoizedState: currentHook.memoizedState,
      baseState: currentHook.baseState,
      baseQueue: currentHook.baseQueue,
      queue: currentHook.queue,
      next: null,
    };

    if (workInProgressHook === null) {
      currentlyRenderingFiber.memoizedState = workInProgressHook = newHook;
    } else {
      workInProgressHook = workInProgressHook.next = newHook;
    }
  }
  return workInProgressHook;
}

// --- Effect push ---

function pushSimpleEffect(
  tag: number,
  inst: EffectInstance,
  create: () => (() => void) | void,
  deps: Array<unknown> | null,
): Effect {
  const effect: Effect = {
    tag,
    create,
    destroy: inst.destroy ?? null,
    deps,
    next: null,
  };
  return pushEffectImpl(effect);
}

function pushEffectImpl(effect: Effect): Effect {
  let componentUpdateQueue: FunctionComponentUpdateQueue | null =
    currentlyRenderingFiber.updateQueue as unknown as FunctionComponentUpdateQueue | null;
  if (componentUpdateQueue === null) {
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    currentlyRenderingFiber.updateQueue = componentUpdateQueue;
  }
  const lastEffect = componentUpdateQueue.lastEffect;
  if (lastEffect === null) {
    componentUpdateQueue.lastEffect = effect.next = effect;
  } else {
    const firstEffect = lastEffect.next;
    lastEffect.next = effect;
    effect.next = firstEffect;
    componentUpdateQueue.lastEffect = effect;
  }
  return effect;
}

// --- Update queue helpers ---

function isRenderPhaseUpdate(fiber: Fiber): boolean {
  const alternate = fiber.alternate;
  return (
    fiber === currentlyRenderingFiber ||
    (alternate !== null && alternate === currentlyRenderingFiber)
  );
}

function enqueueRenderPhaseUpdate<S, A>(queue: UpdateQueue<S, A>, update: Update<S, A>): void {
  didScheduleRenderPhaseUpdateDuringThisPass = true;
  const pending = queue.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;
}

function enqueueUpdate<S, A>(
  fiber: Fiber,
  queue: UpdateQueue<S, A>,
  update: Update<S, A>,
  lane: Lane,
): FiberRoot | null {
  // Concurrent update: append to the queue
  const pending = queue.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  queue.pending = update;

  // Mark the fiber and its return path with lanes
  return markUpdateLaneFromFiberToRoot(fiber, lane);
}

function markUpdateLaneFromFiberToRoot(fiber: Fiber, lane: Lane): FiberRoot | null {
  fiber.lanes = mergeLanes(fiber.lanes, lane);
  const alternate = fiber.alternate;
  if (alternate !== null) {
    alternate.lanes = mergeLanes(alternate.lanes, lane);
  }

  // Walk to root
  let node = fiber.return;
  let root: FiberRoot | null = null;
  if (node === null && fiber.tag === HostRoot) {
    root = fiber.stateNode as FiberRoot;
  } else {
    while (node !== null) {
      node.childLanes = mergeLanes(node.childLanes, lane);
      const nodeAlternate = node.alternate;
      if (nodeAlternate !== null) {
        nodeAlternate.childLanes = mergeLanes(nodeAlternate.childLanes, lane);
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode as FiberRoot;
        break;
      }
      node = node.return;
    }
  }
  return root;
}

// --- State hooks ---

function mountStateImpl<S>(initialState: (() => S) | S): Hook {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === "function") {
    initialState = (initialState as () => S)();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, S | ((s: S) => S)> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue as unknown as UpdateQueue<unknown, unknown>;
  return hook;
}

function mountState<S>(initialState: (() => S) | S): [S, (action: S | ((s: S) => S)) => void] {
  const hook = mountStateImpl(initialState);
  const queue = hook.queue!;
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue) as unknown as (
    action: S | ((s: S) => S),
  ) => void;
  queue.dispatch = dispatch as unknown as ((action: unknown) => void) | null;
  return [hook.memoizedState as S, dispatch];
}

function updateState<S>(_initialState: (() => S) | S): [S, (action: S | ((s: S) => S)) => void] {
  return updateReducer(
    basicStateReducer as unknown as (state: S, action: S | ((s: S) => S)) => S,
    _initialState as unknown as S,
  );
}

function mountReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S,
): [S, (action: A) => void] {
  const hook = mountWorkInProgressHook();
  let initialState: S;
  if (init !== undefined) {
    initialState = init(initialArg);
  } else {
    initialState = initialArg as unknown as S;
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: reducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue as unknown as UpdateQueue<unknown, unknown>;
  const dispatch = dispatchReducerAction.bind(
    null,
    currentlyRenderingFiber,
    queue as unknown as UpdateQueue<unknown, unknown>,
  ) as unknown as (action: A) => void;
  queue.dispatch = dispatch as unknown as ((action: A) => void) | null;
  return [hook.memoizedState as S, dispatch];
}

function updateReducer<S, I, A>(
  reducer: (state: S, action: A) => S,
  _initialArg: I,
  _init?: (arg: I) => S,
): [S, (action: A) => void] {
  const hook = updateWorkInProgressHook();
  return updateReducerImpl(hook, currentHook as Hook, reducer);
}

function updateReducerImpl<S, A>(
  hook: Hook,
  current: Hook,
  reducer: (state: S, action: A) => S,
): [S, (action: A) => void] {
  const queue = hook.queue! as unknown as UpdateQueue<S, A>;
  queue.lastRenderedReducer = reducer;

  let baseQueue = hook.baseQueue as Update<S, A> | null;
  const pendingQueue = queue.pending;

  if (pendingQueue !== null) {
    // Merge pending queue and base queue
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    current.baseQueue = baseQueue = pendingQueue;
    queue.pending = null;
  }

  const baseState = hook.baseState as S;
  if (baseQueue === null) {
    hook.memoizedState = baseState;
  } else {
    const first = baseQueue.next;
    let newState: S = baseState;

    let newBaseState: S | null = null;
    let newBaseQueueFirst: Update<S, A> | null = null;
    let newBaseQueueLast: Update<S, A> | null = null;
    let update = first;

    do {
      const updateLane = update!.lane;

      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // Priority is insufficient. Skip this update.
        const clone: Update<S, A> = {
          lane: updateLane,
          action: update!.action,
          hasEagerState: update!.hasEagerState,
          eagerState: update!.eagerState,
          next: null,
        };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        currentlyRenderingFiber.lanes = mergeLanes(currentlyRenderingFiber.lanes, updateLane);
      } else {
        // This update has sufficient priority.
        if (newBaseQueueLast !== null) {
          const clone: Update<S, A> = {
            lane: NoLane,
            action: update!.action,
            hasEagerState: update!.hasEagerState,
            eagerState: update!.eagerState,
            next: null,
          };
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }

        // Process the update
        const action = update!.action;
        if (update!.hasEagerState) {
          newState = update!.eagerState as S;
        } else {
          newState = reducer(newState, action);
        }
      }
      update = update!.next;
    } while (update !== null && update !== first);

    if (newBaseQueueLast === null) {
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst!;
    }

    if (!objectIs(newState, hook.memoizedState)) {
      markWorkInProgressReceivedUpdateFn?.();
    }

    hook.memoizedState = newState;
    hook.baseState = newBaseState as S;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }

  const dispatch = queue.dispatch!;
  return [hook.memoizedState as S, dispatch];
}

// --- Ref hooks ---

function mountRef<T>(initialValue: T): { current: T } {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;
}

function updateRef<T>(_initialValue: T): { current: T } {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState as { current: T };
}

// --- Effect hooks ---

function mountEffectImpl(
  fiberFlags: Flags,
  hookFlags: number,
  create: () => (() => void) | void,
  deps: Array<unknown> | void | null,
): void {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushSimpleEffect(
    HookHasEffect | hookFlags,
    createEffectInstance(),
    create,
    nextDeps,
  );
}

function updateEffectImpl(
  fiberFlags: Flags,
  hookFlags: number,
  create: () => (() => void) | void,
  deps: Array<unknown> | void | null,
): void {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const effect: Effect = hook.memoizedState as Effect;
  const inst = createEffectInstance();
  inst.destroy = effect.destroy as unknown as void | (() => void);

  if (currentHook !== null) {
    if (nextDeps !== null) {
      const prevEffect: Effect = currentHook.memoizedState as Effect;
      const prevDeps = prevEffect.deps;
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        hook.memoizedState = pushSimpleEffect(hookFlags, inst, create, nextDeps);
        return;
      }
    }
  }

  currentlyRenderingFiber.flags |= fiberFlags;
  hook.memoizedState = pushSimpleEffect(HookHasEffect | hookFlags, inst, create, nextDeps);
}

function mountEffect(create: () => (() => void) | void, deps?: Array<unknown> | null): void {
  mountEffectImpl(PassiveEffect | PassiveStaticEffect, HookPassive, create, deps);
}

function updateEffect(create: () => (() => void) | void, deps?: Array<unknown> | null): void {
  updateEffectImpl(PassiveEffect, HookPassive, create, deps);
}

function mountLayoutEffect(create: () => (() => void) | void, deps?: Array<unknown> | null): void {
  mountEffectImpl(UpdateEffect | LayoutStaticEffect, HookLayout, create, deps);
}

function updateLayoutEffect(create: () => (() => void) | void, deps?: Array<unknown> | null): void {
  updateEffectImpl(UpdateEffect, HookLayout, create, deps);
}

function mountInsertionEffect(
  create: () => (() => void) | void,
  deps?: Array<unknown> | null,
): void {
  mountEffectImpl(UpdateEffect, HookInsertion, create, deps);
}

function updateInsertionEffect(
  create: () => (() => void) | void,
  deps?: Array<unknown> | null,
): void {
  updateEffectImpl(UpdateEffect, HookInsertion, create, deps);
}

// --- Imperative Handle ---

function imperativeHandleEffect<T>(
  create: () => T,
  ref: { current: T | null } | ((inst: T | null) => void) | null | undefined,
): void | (() => void) {
  if (typeof ref === "function") {
    const refCallback = ref;
    const inst = create();
    refCallback(inst);
    return () => {
      refCallback(null);
    };
  } else if (ref !== null && ref !== undefined) {
    const refObject = ref;
    const inst = create();
    refObject.current = inst;
    return () => {
      refObject.current = null;
    };
  }
}

function mountImperativeHandle<T>(
  ref: { current: T | null } | ((inst: T | null) => void) | null | undefined,
  create: () => T,
  deps?: Array<unknown> | null,
): void {
  const effectDeps = deps !== null && deps !== undefined ? deps.concat([ref]) : null;
  mountEffectImpl(
    UpdateEffect | LayoutStaticEffect,
    HookLayout,
    (imperativeHandleEffect<T>).bind(null, create, ref) as unknown as () => (() => void) | void,
    effectDeps,
  );
}

function updateImperativeHandle<T>(
  ref: { current: T | null } | ((inst: T | null) => void) | null | undefined,
  create: () => T,
  deps?: Array<unknown> | null,
): void {
  const effectDeps = deps !== null && deps !== undefined ? deps.concat([ref]) : null;
  updateEffectImpl(
    UpdateEffect,
    HookLayout,
    (imperativeHandleEffect<T>).bind(null, create, ref) as unknown as () => (() => void) | void,
    effectDeps,
  );
}

// --- Callback and Memo hooks ---

function mountCallback<T>(callback: T, deps: Array<unknown> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function updateCallback<T>(callback: T, deps: Array<unknown> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState as [T, Array<unknown> | null];
  if (nextDeps !== null) {
    const prevDeps: Array<unknown> | null = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];
    }
  }
  hook.memoizedState = [callback, nextDeps];
  return callback;
}

function mountMemo<T>(nextCreate: () => T, deps: Array<unknown> | void | null): T {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateMemo<T>(nextCreate: () => T, deps: Array<unknown> | void | null): T {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevState = hook.memoizedState as [T, Array<unknown> | null];
  if (nextDeps !== null) {
    const prevDeps: Array<unknown> | null = prevState[1];
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return prevState[0];
    }
  }
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

// --- Context hook ---

function mountContext<T>(context: ReactContext<T>): T {
  return readContext(context);
}

function updateContext<T>(context: ReactContext<T>): T {
  return readContext(context);
}

// --- Deferred Value hook ---

function mountDeferredValue<T>(value: T, _initialValue?: T): T {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = value;
  return value;
}

function updateDeferredValue<T>(value: T, _initialValue?: T): T {
  const hook = updateWorkInProgressHook();
  const prevValue: T = (currentHook as Hook).memoizedState as T;
  if (objectIs(value, prevValue)) {
    return value;
  }
  // Check if this is a non-urgent update; if so, defer
  if (!includesOnlyNonUrgentLanes(renderLanes)) {
    // Urgent update - keep previous value
    hook.memoizedState = prevValue;
    return prevValue;
  }
  // Non-urgent update - use new value
  markWorkInProgressReceivedUpdateFn?.();
  hook.memoizedState = value;
  return value;
}

// --- Transition hook ---

function mountTransition(): [boolean, (callback: () => void) => void] {
  const stateHook = mountStateImpl(false as boolean);
  const start = startTransition.bind(null, currentlyRenderingFiber, stateHook.queue!, true, false);
  const hook = mountWorkInProgressHook();
  hook.memoizedState = start;
  return [false, start];
}

function updateTransition(): [boolean, (callback: () => void) => void] {
  const [booleanOrThenable] = updateState(false);
  const hook = updateWorkInProgressHook();
  const start = hook.memoizedState as (callback: () => void) => void;
  const isPending = typeof booleanOrThenable === "boolean" ? booleanOrThenable : false;
  return [isPending, start];
}

function startTransition(
  fiber: Fiber,
  queue: UpdateQueue<unknown, unknown>,
  pendingState: unknown,
  finishedState: unknown,
  callback: () => void,
): void {
  const lane = requestUpdateLaneFn?.() ?? SyncLane;

  // Set pending state
  const pendingUpdate: Update<unknown, unknown> = {
    lane,
    action: pendingState,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, pendingUpdate);
  } else {
    const root = enqueueUpdate(fiber, queue, pendingUpdate, lane);
    if (root !== null) {
      if (!scheduleUpdateOnFiberFn) {
        throw new Error(
          "ReactFiberHooks: scheduleUpdateOnFiberFn not initialized. Call setHooksExternals() first.",
        );
      }
      scheduleUpdateOnFiberFn(root, fiber, lane);
    }
  }

  try {
    callback();
  } finally {
    // Set finished state
    const finishedUpdate: Update<unknown, unknown> = {
      lane,
      action: finishedState,
      hasEagerState: false,
      eagerState: null,
      next: null,
    };

    if (isRenderPhaseUpdate(fiber)) {
      enqueueRenderPhaseUpdate(queue, finishedUpdate);
    } else {
      const root = enqueueUpdate(fiber, queue, finishedUpdate, lane);
      if (root !== null) {
        if (!scheduleUpdateOnFiberFn) {
          throw new Error(
            "ReactFiberHooks: scheduleUpdateOnFiberFn not initialized. Call setHooksExternals() first.",
          );
        }
        scheduleUpdateOnFiberFn(root, fiber, lane);
      }
    }
  }
}

// --- SyncExternalStore hook ---

function subscribeToStore<T>(
  fiber: Fiber,
  inst: { value: T; getSnapshot: () => T },
  subscribe: (onStoreChange: () => void) => () => void,
): () => void {
  const handleStoreChange = () => {
    // Check if the value changed
    if (checkIfSnapshotChanged(inst)) {
      // Force a re-render
      const lane = SyncLane;
      const root = markUpdateLaneFromFiberToRoot(fiber, lane);
      if (root !== null) {
        if (!scheduleUpdateOnFiberFn) {
          throw new Error(
            "ReactFiberHooks: scheduleUpdateOnFiberFn not initialized. Call setHooksExternals() first.",
          );
        }
        scheduleUpdateOnFiberFn(root, fiber, lane);
      }
    }
  };
  return subscribe(handleStoreChange);
}

function checkIfSnapshotChanged<T>(inst: { value: T; getSnapshot: () => T }): boolean {
  const latestGetSnapshot = inst.getSnapshot;
  const prevValue = inst.value;
  try {
    const nextValue = latestGetSnapshot();
    return !objectIs(prevValue, nextValue);
  } catch {
    return true;
  }
}

function mountSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  _getServerSnapshot?: () => T,
): T {
  const fiber = currentlyRenderingFiber;
  const hook = mountWorkInProgressHook();

  const nextSnapshot = getSnapshot();
  hook.memoizedState = nextSnapshot;

  const inst = {
    value: nextSnapshot,
    getSnapshot,
  };
  hook.queue = inst as unknown as UpdateQueue<unknown, unknown>;

  // Subscribe effect
  mountEffect(
    subscribeToStore.bind(null, fiber, inst, subscribe) as unknown as () => (() => void) | void,
    [subscribe],
  );

  // Update store instance effect
  fiber.flags |= PassiveEffect;
  pushSimpleEffect(
    HookHasEffect | HookPassive,
    createEffectInstance(),
    updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot),
    null,
  );

  return nextSnapshot;
}

function updateStoreInstance<T>(
  _fiber: Fiber,
  inst: { value: T; getSnapshot: () => T },
  nextSnapshot: T,
  getSnapshot: () => T,
): void {
  inst.value = nextSnapshot;
  inst.getSnapshot = getSnapshot;
}

function updateSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  _getServerSnapshot?: () => T,
): T {
  const fiber = currentlyRenderingFiber;
  const hook = updateWorkInProgressHook();

  const nextSnapshot = getSnapshot();
  const prevSnapshot = (currentHook || hook).memoizedState;
  const snapshotChanged = !objectIs(prevSnapshot, nextSnapshot);

  if (snapshotChanged) {
    hook.memoizedState = nextSnapshot;
    markWorkInProgressReceivedUpdateFn?.();
  }

  const inst = hook.queue as unknown as { value: T; getSnapshot: () => T };
  updateEffect(
    subscribeToStore.bind(null, fiber, inst, subscribe) as unknown as () => (() => void) | void,
    [subscribe],
  );

  if (inst.getSnapshot !== getSnapshot || snapshotChanged) {
    fiber.flags |= PassiveEffect;
    pushSimpleEffect(
      HookHasEffect | HookPassive,
      createEffectInstance(),
      updateStoreInstance.bind(null, fiber, inst, nextSnapshot, getSnapshot),
      null,
    );
  }

  return nextSnapshot;
}

// --- Id hook ---

function mountId(): string {
  const hook = mountWorkInProgressHook();

  const root = workInProgressRoot;
  const identifierPrefix = root ? root.identifierPrefix : "";
  const globalClientId = globalClientIdCounter++;
  const id = "_" + identifierPrefix + "r_" + globalClientId.toString(32) + "_";

  hook.memoizedState = id;
  return id;
}

function updateId(): string {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState as string;
}

// --- Debug Value ---

function mountDebugValue<T>(_value: T, _formatterFn?: (value: T) => unknown): void {
  // No-op
}

const updateDebugValue = mountDebugValue;

// --- use hook ---

function use<T>(usable: unknown): T {
  if (usable !== null && typeof usable === "object") {
    const obj = usable as Record<string, unknown>;
    if (typeof obj.then === "function") {
      throw usable; // Suspend (throw the thenable)
    } else if (obj.$$typeof === REACT_CONTEXT_TYPE) {
      return readContext(usable as ReactContext<T>);
    }
  }
  throw new Error("An unsupported type was passed to use(): " + String(usable));
}

// --- Optimistic hook (simplified) ---

function mountOptimistic<S, A>(
  passthrough: S,
  _reducer?: (state: S, action: A) => S,
): [S, (action: A) => void] {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = hook.baseState = passthrough;
  const queue: UpdateQueue<S, A> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: null,
    lastRenderedState: null,
  };
  hook.queue = queue as unknown as UpdateQueue<unknown, unknown>;
  const dispatch = ((action: A) => {
    // Simplified: dispatch optimistic update
    dispatchSetState(currentlyRenderingFiber, queue, action);
  }) as (action: A) => void;
  queue.dispatch = dispatch as unknown as ((action: A) => void) | null;
  return [passthrough, dispatch];
}

function updateOptimistic<S, A>(
  passthrough: S,
  reducer?: (state: S, action: A) => S,
): [S, (action: A) => void] {
  const hook = updateWorkInProgressHook();
  hook.baseState = passthrough;
  const resolvedReducer =
    typeof reducer === "function"
      ? reducer
      : (basicStateReducer as unknown as (state: S, action: A) => S);
  return updateReducerImpl(hook, currentHook as Hook, resolvedReducer);
}

// --- Action State (simplified) ---

function mountActionState<S, P>(
  _action: (state: Awaited<S>, payload: P) => S,
  initialState: Awaited<S>,
  _permalink?: string,
): [Awaited<S>, (payload: P) => void, boolean] {
  const stateHook = mountWorkInProgressHook();
  stateHook.memoizedState = stateHook.baseState = initialState;

  const stateQueue: UpdateQueue<unknown, unknown> = {
    pending: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  stateHook.queue = stateQueue;
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, stateQueue) as unknown as (
    payload: P,
  ) => void;
  stateQueue.dispatch = dispatch as unknown as (action: unknown) => void;

  // pending hook
  const pendingHook = mountWorkInProgressHook();
  pendingHook.memoizedState = false;

  // action hook
  const actionHook = mountWorkInProgressHook();
  actionHook.memoizedState = _action;

  return [initialState, dispatch, false];
}

function updateActionState<S, P>(
  _action: (state: Awaited<S>, payload: P) => S,
  _initialState: Awaited<S>,
  _permalink?: string,
): [Awaited<S>, (payload: P) => void, boolean] {
  const [state, dispatch] = updateReducer(
    basicStateReducer as unknown as (state: Awaited<S>, action: unknown) => Awaited<S>,
    null,
  );
  // pending
  const [isPending] = updateReducer(
    basicStateReducer as unknown as (state: boolean, action: unknown) => boolean,
    null,
  );
  // action
  const actionHook = updateWorkInProgressHook();
  actionHook.memoizedState = _action;

  return [state as Awaited<S>, dispatch, !!isPending];
}

// --- Dispatch functions ---

function dispatchSetState<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A): void {
  const lane = requestUpdateLaneFn?.() ?? SyncLane;

  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    // Try eager state computation
    const alternate = fiber.alternate;
    if (fiber.lanes === NoLanes && (alternate === null || alternate.lanes === NoLanes)) {
      const lastRenderedReducer = queue.lastRenderedReducer;
      if (lastRenderedReducer !== null) {
        try {
          const currentState: S = queue.lastRenderedState as S;
          const eagerState = lastRenderedReducer(currentState, action);
          update.hasEagerState = true;
          update.eagerState = eagerState;
          if (objectIs(eagerState, currentState)) {
            // Fast path: bail out without scheduling
            // Still enqueue the update in case we need to rebase later
            enqueueUpdate(fiber, queue, update, lane);
            return;
          }
        } catch {
          // Suppress the error, it will throw again in render
        }
      }
    }

    const root = enqueueUpdate(fiber, queue, update, lane);
    if (root !== null && scheduleUpdateOnFiberFn) {
      scheduleUpdateOnFiberFn(root, fiber, lane);
    }
  }
}

function dispatchReducerAction<S, A>(fiber: Fiber, queue: UpdateQueue<S, A>, action: A): void {
  const lane = requestUpdateLaneFn?.() ?? SyncLane;

  const update: Update<S, A> = {
    lane,
    action,
    hasEagerState: false,
    eagerState: null,
    next: null,
  };

  if (isRenderPhaseUpdate(fiber)) {
    enqueueRenderPhaseUpdate(queue, update);
  } else {
    const root = enqueueUpdate(fiber, queue, update, lane);
    if (root !== null && scheduleUpdateOnFiberFn) {
      scheduleUpdateOnFiberFn(root, fiber, lane);
    }
  }
}

// --- Dispatchers ---

const HooksDispatcherOnMount: Dispatcher = {
  useState: mountState,
  useReducer: mountReducer as unknown as Dispatcher["useReducer"],
  useEffect: mountEffect,
  useLayoutEffect: mountLayoutEffect,
  useInsertionEffect: mountInsertionEffect,
  useCallback: mountCallback as unknown as Dispatcher["useCallback"],
  useMemo: mountMemo as unknown as Dispatcher["useMemo"],
  useRef: mountRef,
  useContext: mountContext,
  useImperativeHandle: mountImperativeHandle as unknown as Dispatcher["useImperativeHandle"],
  useDebugValue: mountDebugValue,
  useDeferredValue: mountDeferredValue,
  useTransition: mountTransition,
  useSyncExternalStore: mountSyncExternalStore,
  useId: mountId,
  use,
  useOptimistic: mountOptimistic as unknown as Dispatcher["useOptimistic"],
  useActionState: mountActionState as unknown as Dispatcher["useActionState"],
};

const HooksDispatcherOnUpdate: Dispatcher = {
  useState: updateState,
  useReducer: updateReducer as unknown as Dispatcher["useReducer"],
  useEffect: updateEffect,
  useLayoutEffect: updateLayoutEffect,
  useInsertionEffect: updateInsertionEffect,
  useCallback: updateCallback as unknown as Dispatcher["useCallback"],
  useMemo: updateMemo as unknown as Dispatcher["useMemo"],
  useRef: updateRef,
  useContext: updateContext,
  useImperativeHandle: updateImperativeHandle as unknown as Dispatcher["useImperativeHandle"],
  useDebugValue: updateDebugValue,
  useDeferredValue: updateDeferredValue,
  useTransition: updateTransition,
  useSyncExternalStore: updateSyncExternalStore,
  useId: updateId,
  use,
  useOptimistic: updateOptimistic as unknown as Dispatcher["useOptimistic"],
  useActionState: updateActionState as unknown as Dispatcher["useActionState"],
};

const ContextOnlyDispatcher: Dispatcher = {
  useState: throwInvalidHookError as unknown as Dispatcher["useState"],
  useReducer: throwInvalidHookError as unknown as Dispatcher["useReducer"],
  useEffect: throwInvalidHookError as unknown as Dispatcher["useEffect"],
  useLayoutEffect: throwInvalidHookError as unknown as Dispatcher["useLayoutEffect"],
  useInsertionEffect: throwInvalidHookError as unknown as Dispatcher["useInsertionEffect"],
  useCallback: throwInvalidHookError as unknown as Dispatcher["useCallback"],
  useMemo: throwInvalidHookError as unknown as Dispatcher["useMemo"],
  useRef: throwInvalidHookError as unknown as Dispatcher["useRef"],
  useContext: throwInvalidHookError as unknown as Dispatcher["useContext"],
  useImperativeHandle: throwInvalidHookError as unknown as Dispatcher["useImperativeHandle"],
  useDebugValue: throwInvalidHookError as unknown as Dispatcher["useDebugValue"],
  useDeferredValue: throwInvalidHookError as unknown as Dispatcher["useDeferredValue"],
  useTransition: throwInvalidHookError as unknown as Dispatcher["useTransition"],
  useSyncExternalStore: throwInvalidHookError as unknown as Dispatcher["useSyncExternalStore"],
  useId: throwInvalidHookError as unknown as Dispatcher["useId"],
  use: throwInvalidHookError as unknown as Dispatcher["use"],
  useOptimistic: throwInvalidHookError as unknown as Dispatcher["useOptimistic"],
  useActionState: throwInvalidHookError as unknown as Dispatcher["useActionState"],
};

function throwInvalidHookError(): never {
  throw new Error(
    "Invalid hook call. Hooks can only be called inside of the body of a function component.",
  );
}

// --- renderWithHooks ---

export function renderWithHooks<Props>(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (props: Props, secondArg?: unknown) => unknown,
  props: Props,
  secondArg: unknown,
  nextRenderLanes: Lanes,
): unknown {
  renderLanes = nextRenderLanes;
  currentlyRenderingFiber = workInProgress;

  workInProgress.memoizedState = null;
  workInProgress.updateQueue = null;
  workInProgress.lanes = NoLanes;

  prepareToReadContext(workInProgress, nextRenderLanes);

  // Set dispatcher based on mount vs update
  ReactSharedInternals.H =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount
      : HooksDispatcherOnUpdate;

  let children = Component(props, secondArg);

  // Check for render phase updates
  if (didScheduleRenderPhaseUpdateDuringThisPass) {
    children = renderWithHooksAgain(workInProgress, Component, props, secondArg);
  }

  finishRenderingHooks(current, workInProgress);

  return children;
}

function renderWithHooksAgain<Props>(
  workInProgress: Fiber,
  Component: (props: Props, secondArg?: unknown) => unknown,
  props: Props,
  secondArg: unknown,
): unknown {
  let children;
  let numberOfReRenders = 0;

  do {
    didScheduleRenderPhaseUpdateDuringThisPass = false;

    if (numberOfReRenders >= RE_RENDER_LIMIT) {
      throw new Error(
        "Too many re-renders. React limits the number of renders to prevent " + "an infinite loop.",
      );
    }

    numberOfReRenders += 1;

    // Start over from the beginning of the list
    currentHook = null;
    workInProgressHook = null;

    workInProgress.updateQueue = null;

    ReactSharedInternals.H = HooksDispatcherOnUpdate;

    children = Component(props, secondArg);
  } while (didScheduleRenderPhaseUpdateDuringThisPass);

  return children;
}

function finishRenderingHooks(_current: Fiber | null, _workInProgress: Fiber): void {
  ReactSharedInternals.H = ContextOnlyDispatcher;

  renderLanes = NoLanes;
  currentlyRenderingFiber = null as unknown as Fiber;

  currentHook = null;
  workInProgressHook = null;
}

// --- Bailout hooks ---

export function bailoutHooks(current: Fiber, workInProgress: Fiber, lanes: Lanes): void {
  workInProgress.updateQueue = current.updateQueue;
  workInProgress.flags &= ~(PassiveEffect | UpdateEffect);
  current.lanes = removeLanes(current.lanes, lanes);
}

// Export for use by work loop
export function resetHooksAfterThrow(): void {
  currentlyRenderingFiber = null as unknown as Fiber;
  currentHook = null;
  workInProgressHook = null;
  didScheduleRenderPhaseUpdateDuringThisPass = false;
  ReactSharedInternals.H = ContextOnlyDispatcher;
}
