import type { WorkTag } from "./ReactWorkTags.js";
import type { Flags } from "./ReactFiberFlags.js";
import type { Lane, LaneMap, Lanes } from "./ReactFiberLane.js";
import type { HostConfig } from "../host-config/HostConfigInterface.js";
import type { ReactContext } from "../react/ReactTypes.js";

// A Fiber is work on a Component that needs to be done or was done.
export interface Fiber {
  tag: WorkTag;
  key: string | null;
  elementType: unknown;
  type: unknown;
  stateNode: unknown;

  // Fiber tree structure
  return: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  index: number;

  ref: unknown;
  refCleanup: (() => void) | null;

  // Props & state
  pendingProps: unknown;
  memoizedProps: unknown;
  updateQueue: unknown;
  memoizedState: unknown;

  // Context dependencies
  dependencies: Dependencies | null;

  // Effects
  flags: Flags;
  subtreeFlags: Flags;
  deletions: Array<Fiber> | null;

  // Lanes
  lanes: Lanes;
  childLanes: Lanes;

  // Double-buffering
  alternate: Fiber | null;
}

// Dependencies for context
export interface ContextDependency<T = unknown> {
  context: ReactContext<T>;
  next: ContextDependency | null;
  memoizedValue: T;
}

export interface Dependencies {
  lanes: Lanes;
  firstContext: ContextDependency | null;
}

// FiberRoot is the root of a React tree
export interface FiberRoot {
  containerInfo: unknown;
  current: Fiber;
  finishedWork: Fiber | null;

  // Scheduler
  callbackNode: unknown;
  callbackPriority: Lane;

  // Lanes
  pendingLanes: Lanes;
  suspendedLanes: Lanes;
  pingedLanes: Lanes;
  expiredLanes: Lanes;
  entangledLanes: Lanes;
  entanglements: LaneMap<Lanes>;

  // Host config reference
  hostConfig: HostConfig;

  // Passive effects
  pendingPassiveEffects: PendingPassiveEffects;

  // Id generation
  identifierPrefix: string;
  identifierCount: number;
}

export interface PendingPassiveEffects {
  unmount: Array<Fiber>;
  mount: Array<Fiber>;
  update: Array<Fiber>;
}

// Hook is a linked list node
export interface Hook {
  memoizedState: unknown;
  baseState: unknown;
  baseQueue: Update<unknown, unknown> | null;
  queue: UpdateQueue<unknown, unknown> | null;
  next: Hook | null;
}

// Update object for state updates
export interface Update<S = unknown, A = unknown> {
  lane: Lane;
  action: A;
  hasEagerState: boolean;
  eagerState: S | null;
  next: Update<S, A> | null;
}

// UpdateQueue for state updates (used by hooks and class components)
export interface UpdateQueue<S = unknown, A = unknown> {
  pending: Update<S, A> | null;
  lanes: Lanes;
  dispatch: ((action: A) => void) | null;
  lastRenderedReducer: ((state: S, action: A) => S) | null;
  lastRenderedState: S | null;
}

// Class component update queue
export interface ClassUpdateQueue<S = unknown> {
  baseState: S;
  firstBaseUpdate: ClassUpdate<S> | null;
  lastBaseUpdate: ClassUpdate<S> | null;
  shared: {
    pending: ClassUpdate<S> | null;
  };
  callbacks: Array<() => void> | null;
}

export interface ClassUpdate<S = unknown> {
  lane: Lane;
  tag: 0 | 1 | 2 | 3; // UpdateState, ReplaceState, ForceUpdate, CaptureUpdate
  payload: unknown;
  callback: (() => void) | null;
  next: ClassUpdate<S> | null;
}

// Effect (for useEffect, useLayoutEffect, etc.)
export interface Effect {
  tag: number;
  create: () => (() => void) | void;
  destroy: (() => void) | void | null;
  deps: Array<unknown> | null;
  next: Effect | null;
}

// Effect list stored on fiber's updateQueue for function components
export interface FunctionComponentUpdateQueue {
  lastEffect: Effect | null;
  events: Array<unknown> | null;
  stores: Array<StoreConsistencyCheck<unknown>> | null;
}

export interface StoreConsistencyCheck<T> {
  value: T;
  getSnapshot: () => T;
}
