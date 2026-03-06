// Work Loop - Scheduling and execution of React render and commit phases

import type { Fiber, FiberRoot } from "./ReactFiberTypes.js";
import type { Lane, Lanes } from "./ReactFiberLane.js";
import {
  getHighestPriorityLane,
  getNextLanes,
  markRootFinished,
  markRootUpdated,
  mergeLanes,
  NoLane,
  NoLanes,
  SyncLane,
} from "./ReactFiberLane.js";
import { LayoutMask, MutationMask, NoFlags, PassiveMask } from "./ReactFiberFlags.js";
import { createWorkInProgress } from "./ReactFiber.js";
import { beginWork } from "./ReactFiberBeginWork.js";
import { completeWork } from "./ReactFiberCompleteWork.js";
import {
  commitBeforeMutationEffects,
  commitLayoutEffects,
  commitMutationEffects,
  commitPassiveMountEffects,
  commitPassiveUnmountEffects,
} from "./ReactFiberCommitWork.js";
import {
  cancelCallback,
  ImmediatePriority,
  NormalPriority,
  scheduleCallback,
  shouldYield,
} from "../scheduler/Scheduler.js";
import type { PriorityLevel } from "../scheduler/SchedulerPriorities.js";
import type { Task } from "../scheduler/Scheduler.js";
import { setHooksExternals, setWorkInProgressRoot } from "./ReactFiberHooks.js";
import { markWorkInProgressReceivedUpdate } from "./ReactFiberBeginWork.js";

// Work-in-progress state
let workInProgressRoot: FiberRoot | null = null;
let workInProgress: Fiber | null = null;
let workInProgressRenderLanes: Lanes = NoLanes;

// Initialize hooks externals to break circular dependency
function requestUpdateLane(): Lane {
  return SyncLane;
}

setHooksExternals({
  scheduleUpdateOnFiber,
  requestUpdateLane,
  markWorkInProgressReceivedUpdate,
});

// Root-level scheduling state
let rootDoesHavePassiveEffects = false;
let rootWithPendingPassiveEffects: FiberRoot | null = null;

export function scheduleUpdateOnFiber(root: FiberRoot, _fiber: Fiber, lane: Lane): void {
  // Mark the fiber and root as having pending work
  markRootUpdated(root, lane);

  // Schedule work on the root
  ensureRootIsScheduled(root);
}

function ensureRootIsScheduled(root: FiberRoot): void {
  const nextLanes = getNextLanes(root, NoLanes);

  if (nextLanes === NoLanes) {
    // No pending work
    if (root.callbackNode !== null) {
      cancelCallback(root.callbackNode as Task);
      root.callbackNode = null;
    }
    root.callbackPriority = NoLane;
    return;
  }

  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  // Check if there's already a scheduled callback with the same priority
  const existingCallbackPriority = root.callbackPriority;
  if (existingCallbackPriority === newCallbackPriority) {
    return; // Already scheduled
  }

  // Cancel existing callback if different priority
  if (root.callbackNode !== null) {
    cancelCallback(root.callbackNode as Task);
  }

  // Schedule new callback
  let newCallbackNode;

  if (newCallbackPriority === SyncLane) {
    // Sync work - schedule immediately
    scheduleSyncCallback(() => {
      performSyncWorkOnRoot(root);
    });
    newCallbackNode = null;
  } else {
    // Async work
    const priority = laneToPriority(newCallbackPriority);
    newCallbackNode = scheduleCallback(priority, () => {
      performConcurrentWorkOnRoot(root);
    });
  }

  root.callbackNode = newCallbackNode;
  root.callbackPriority = newCallbackPriority;
}

function laneToPriority(lane: Lane): PriorityLevel {
  if (lane === SyncLane) return ImmediatePriority;
  return NormalPriority;
}

// Sync callbacks queue
let syncQueue: Array<() => void> | null = null;
let isFlushingSyncQueue = false;

function scheduleSyncCallback(callback: () => void): void {
  if (syncQueue === null) {
    syncQueue = [callback];
    // Schedule a microtask to flush
    queueMicrotask(flushSyncCallbacks);
  } else {
    syncQueue.push(callback);
  }
}

function flushSyncCallbacks(): void {
  if (isFlushingSyncQueue) return;
  isFlushingSyncQueue = true;
  const queue = syncQueue;
  syncQueue = null;
  if (queue !== null) {
    for (let i = 0; i < queue.length; i++) {
      queue[i]!();
    }
  }
  isFlushingSyncQueue = false;
}

// ─── Sync Work ──────────────────────────────────────────────────────────

export function performSyncWorkOnRoot(root: FiberRoot): void {
  const lanes = getNextLanes(root, NoLanes);
  if (lanes === NoLanes) return;

  // Render phase
  renderRootSync(root, lanes);

  // Commit phase
  const finishedWork = root.current.alternate;
  if (finishedWork !== null) {
    root.finishedWork = finishedWork;
    commitRoot(root);
  }

  ensureRootIsScheduled(root);
}

// ─── Concurrent Work ────────────────────────────────────────────────────

function performConcurrentWorkOnRoot(root: FiberRoot): void {
  // Concurrent mode not yet implemented — falls back to synchronous rendering.
  // workLoopConcurrent (below) is ready but not wired in yet.
  performSyncWorkOnRoot(root);
}

// ─── Render Phase ───────────────────────────────────────────────────────

function renderRootSync(root: FiberRoot, lanes: Lanes): void {
  // Prepare fresh stack
  if (workInProgressRoot !== root || workInProgressRenderLanes !== lanes) {
    prepareFreshStack(root, lanes);
  }

  // Work loop
  workLoopSync();

  // Done rendering
  workInProgressRoot = null;
  workInProgressRenderLanes = NoLanes;
  setWorkInProgressRoot(null, NoLanes);
}

function prepareFreshStack(root: FiberRoot, lanes: Lanes): void {
  root.finishedWork = null;

  workInProgressRoot = root;
  const rootWorkInProgress = createWorkInProgress(root.current, null);
  workInProgress = rootWorkInProgress;
  workInProgressRenderLanes = lanes;

  // Sync hooks with current WIP root and lanes
  setWorkInProgressRoot(root, lanes);
}

function workLoopSync(): void {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

/** Reserved for concurrent mode - used when shouldYield is available. */
export function workLoopConcurrent(): void {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;

  // BeginWork returns the next child to work on, or null
  const next = beginWork(current, unitOfWork, workInProgressRenderLanes);
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // No more children - complete this unit
    completeUnitOfWork(unitOfWork);
  } else {
    workInProgress = next;
  }
}

function completeUnitOfWork(unitOfWork: Fiber): void {
  let completedWork: Fiber | null = unitOfWork;

  do {
    const current = completedWork.alternate;
    const returnFiber: Fiber | null = completedWork.return;

    // Complete the work for this fiber
    const next = completeWork(current, completedWork, workInProgressRenderLanes);

    if (next !== null) {
      // Completing this fiber spawned new work
      workInProgress = next;
      return;
    }

    // Move to sibling
    const siblingFiber = completedWork.sibling;
    if (siblingFiber !== null) {
      workInProgress = siblingFiber;
      return;
    }

    // No sibling - go up to parent
    completedWork = returnFiber;
    workInProgress = completedWork;
  } while (completedWork !== null);
}

// ─── Commit Phase ───────────────────────────────────────────────────────

function commitRoot(root: FiberRoot): void {
  const finishedWork = root.finishedWork;
  if (finishedWork === null) return;

  root.finishedWork = null;
  root.callbackNode = null;
  root.callbackPriority = NoLane;

  // Check for passive effects
  if (
    (finishedWork.subtreeFlags & PassiveMask) !== NoFlags ||
    (finishedWork.flags & PassiveMask) !== NoFlags
  ) {
    if (!rootDoesHavePassiveEffects) {
      rootDoesHavePassiveEffects = true;
      scheduleCallback(NormalPriority, () => {
        flushPassiveEffects();
      });
    }
  }

  // Check if there are any effects to commit
  const subtreeHasEffects =
    (finishedWork.subtreeFlags & (MutationMask | LayoutMask | PassiveMask)) !== NoFlags;
  const rootHasEffect =
    (finishedWork.flags & (MutationMask | LayoutMask | PassiveMask)) !== NoFlags;

  if (subtreeHasEffects || rootHasEffect) {
    const hostConfig = root.hostConfig;

    // Before mutation phase
    hostConfig.prepareForCommit(root.containerInfo);
    commitBeforeMutationEffects(root, finishedWork);

    // Mutation phase - modify the DOM
    commitMutationEffects(root, finishedWork);

    // Swap the current tree
    root.current = finishedWork;

    // Layout phase
    commitLayoutEffects(root, finishedWork);

    hostConfig.resetAfterCommit(root.containerInfo);
  } else {
    // No effects - just swap the tree
    root.current = finishedWork;
  }

  // Handle passive effects
  if (rootDoesHavePassiveEffects) {
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
  }

  // Mark lanes as finished
  const remainingLanes = mergeLanes(finishedWork.lanes, finishedWork.childLanes);
  markRootFinished(root, remainingLanes);

  // Schedule any remaining work
  ensureRootIsScheduled(root);
}

export function flushPassiveEffects(): void {
  if (rootWithPendingPassiveEffects === null) return;

  const root = rootWithPendingPassiveEffects;
  rootWithPendingPassiveEffects = null;

  const finishedWork = root.current;

  // Unmount old effects
  commitPassiveUnmountEffects(finishedWork);

  // Mount new effects
  commitPassiveMountEffects(root, finishedWork);

  // Flush any sync work scheduled by effects
  flushSyncCallbacks();
}

// ─── Public flush for testing ────────────────────────────────────────────

export function flushSync(fn?: () => void): void {
  if (fn) {
    fn();
  }
  flushSyncCallbacks();
}
