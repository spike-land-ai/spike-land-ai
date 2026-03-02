import type { ReactContext } from "../react/ReactTypes.js";
import type { ContextDependency, Fiber } from "./ReactFiberTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import { isSubsetOfLanes, mergeLanes, NoLanes } from "./ReactFiberLane.js";

// Simple value stack for context
interface StackCursor<T> {
  current: T;
}

function createCursor<T>(defaultValue: T): StackCursor<T> {
  return { current: defaultValue };
}

const valueStack: Array<unknown> = [];
let index = -1;

function push<T>(cursor: StackCursor<T>, value: T): void {
  index++;
  valueStack[index] = cursor.current;
  cursor.current = value;
}

function pop<T>(cursor: StackCursor<T>): void {
  if (index < 0) {
    return;
  }
  cursor.current = valueStack[index] as T;
  valueStack[index] = null;
  index--;
}

const valueCursor: StackCursor<unknown> = createCursor(null);

let currentlyRenderingFiber: Fiber | null = null;
let lastContextDependency: ContextDependency | null = null;

export function resetContextDependencies(): void {
  currentlyRenderingFiber = null;
  lastContextDependency = null;
}

export function pushProvider<T>(
  _providerFiber: Fiber,
  context: ReactContext<T>,
  nextValue: T,
): void {
  push(valueCursor, context._currentValue);
  context._currentValue = nextValue;
}

export function popProvider(context: ReactContext<unknown>, _providerFiber?: Fiber): void {
  const currentValue = valueCursor.current;
  context._currentValue = currentValue;
  pop(valueCursor);
}

export function readContext<T>(context: ReactContext<T>): T {
  return readContextForConsumer(currentlyRenderingFiber, context);
}

export function prepareToReadContext(workInProgress: Fiber, _renderLanes: Lanes): void {
  currentlyRenderingFiber = workInProgress;
  lastContextDependency = null;

  const dependencies = workInProgress.dependencies;
  if (dependencies !== null) {
    // Reset the context dependency list for this render pass so dependencies
    // are re-recorded. Context-changed detection for bail-out optimization is
    // not yet implemented (requires propagateContextChange integration).
    dependencies.firstContext = null;
  }
}

function readContextForConsumer<T>(consumer: Fiber | null, context: ReactContext<T>): T {
  const value: T = context._currentValue;

  if (consumer === null) {
    return value;
  }

  const contextItem: ContextDependency<T> = {
    context,
    memoizedValue: value,
    next: null,
  };

  if (lastContextDependency === null) {
    // This is the first dependency for this fiber
    if (consumer.dependencies === null) {
      consumer.dependencies = {
        lanes: NoLanes,
        firstContext: contextItem,
      };
    } else {
      consumer.dependencies.firstContext = contextItem;
    }
    lastContextDependency = contextItem;
  } else {
    // Append to the existing list
    lastContextDependency = lastContextDependency.next = contextItem;
  }

  return value;
}

// Check if context has changed since the last render
export function propagateContextChange(
  workInProgress: Fiber,
  context: ReactContext<unknown>,
  renderLanes: Lanes,
): void {
  let fiber: Fiber | null = workInProgress.child;
  if (fiber !== null) {
    fiber.return = workInProgress;
  }

  while (fiber !== null) {
    const dependencies = fiber.dependencies;
    if (dependencies !== null) {
      const nextFiber: Fiber | null = fiber.child;

      let dependency = dependencies.firstContext;
      while (dependency !== null) {
        if (dependency.context === context) {
          // Found a match. Schedule an update on this fiber.
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);
          const alternate = fiber.alternate;
          if (alternate !== null) {
            alternate.lanes = mergeLanes(alternate.lanes, renderLanes);
          }

          // Propagate the changed lanes up the return path
          scheduleContextWorkOnParentPath(fiber.return, renderLanes);

          // Mark that this dependency has changed
          dependencies.lanes = mergeLanes(dependencies.lanes, renderLanes);
          break;
        }
        dependency = dependency.next;
      }

      // Continue traversal from child or sibling
      if (nextFiber !== null) {
        nextFiber.return = fiber;
      }
      fiber = nextFiber;
      continue;
    }

    // Traverse children
    if (fiber.child !== null) {
      fiber.child.return = fiber;
      fiber = fiber.child;
      continue;
    }

    if (fiber === workInProgress) {
      return;
    }

    while (fiber!.sibling === null) {
      if (fiber!.return === null || fiber!.return === workInProgress) {
        return;
      }
      fiber = fiber!.return;
    }

    fiber!.sibling!.return = fiber!.return;
    fiber = fiber!.sibling;
  }
}

function scheduleContextWorkOnParentPath(parent: Fiber | null, renderLanes: Lanes): void {
  let node = parent;
  while (node !== null) {
    const alternate = node.alternate;
    if (!isSubsetOfLanes(node.childLanes, renderLanes)) {
      node.childLanes = mergeLanes(node.childLanes, renderLanes);
      if (alternate !== null) {
        alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
      }
    } else if (alternate !== null && !isSubsetOfLanes(alternate.childLanes, renderLanes)) {
      alternate.childLanes = mergeLanes(alternate.childLanes, renderLanes);
    } else {
      // Already updated
      break;
    }
    node = node.return;
  }
}
