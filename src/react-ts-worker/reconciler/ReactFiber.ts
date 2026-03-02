import type { Fiber } from "./ReactFiberTypes.js";
import type { WorkTag } from "./ReactWorkTags.js";
import type { Lanes } from "./ReactFiberLane.js";
import type { ReactElement } from "../react/ReactTypes.js";
import { NoFlags, StaticMask } from "./ReactFiberFlags.js";
import { NoLanes } from "./ReactFiberLane.js";
import {
  ClassComponent,
  ContextConsumer,
  ContextProvider,
  ForwardRef,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  LazyComponent,
  MemoComponent,
  SuspenseComponent,
} from "./ReactWorkTags.js";
import {
  REACT_CONSUMER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_MEMO_TYPE,
  REACT_SUSPENSE_TYPE,
} from "../react/ReactSymbols.js";

function createFiber(tag: WorkTag, pendingProps: unknown, key: string | null): Fiber {
  return {
    tag,
    key,
    elementType: null,
    type: null,
    stateNode: null,

    return: null,
    child: null,
    sibling: null,
    index: 0,

    ref: null,
    refCleanup: null,

    pendingProps,
    memoizedProps: null,
    updateQueue: null,
    memoizedState: null,
    dependencies: null,

    flags: NoFlags,
    subtreeFlags: NoFlags,
    deletions: null,

    lanes: NoLanes,
    childLanes: NoLanes,

    alternate: null,
  };
}

function shouldConstruct(Component: (...args: unknown[]) => unknown): boolean {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

export function isSimpleFunctionComponent(type: unknown): boolean {
  return (
    typeof type === "function" &&
    !shouldConstruct(type as (...args: unknown[]) => unknown) &&
    (type as unknown as Record<string, unknown>).defaultProps === undefined
  );
}

export function createFiberFromElement(element: ReactElement, lanes: Lanes): Fiber {
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  return createFiberFromTypeAndProps(type, key, pendingProps, lanes);
}

export function createFiberFromTypeAndProps(
  type: unknown,
  key: string | null,
  pendingProps: unknown,
  lanes: Lanes,
): Fiber {
  let fiberTag: WorkTag = FunctionComponent;
  let resolvedType = type;

  if (typeof type === "function") {
    if (shouldConstruct(type as (...args: unknown[]) => unknown)) {
      fiberTag = ClassComponent;
    }
  } else if (typeof type === "string") {
    fiberTag = HostComponent;
  } else {
    switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(
          (pendingProps as Record<string, unknown>).children,
          lanes,
          key,
        );
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, lanes, key);
      default: {
        if (typeof type === "object" && type !== null) {
          switch ((type as Record<string, unknown>).$$typeof) {
            case REACT_CONTEXT_TYPE:
              fiberTag = ContextProvider;
              break;
            case REACT_CONSUMER_TYPE:
              fiberTag = ContextConsumer;
              break;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              break;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break;
          }
        }
      }
    }
  }

  const fiber = createFiber(fiberTag, pendingProps, key);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromText(content: string, lanes: Lanes): Fiber {
  const fiber = createFiber(HostText, content, null);
  fiber.lanes = lanes;
  return fiber;
}

export function createFiberFromFragment(
  elements: unknown,
  lanes: Lanes,
  key: string | null,
): Fiber {
  const fiber = createFiber(Fragment, elements, key);
  fiber.lanes = lanes;
  return fiber;
}

function createFiberFromSuspense(pendingProps: unknown, lanes: Lanes, key: string | null): Fiber {
  const fiber = createFiber(SuspenseComponent, pendingProps, key);
  fiber.elementType = REACT_SUSPENSE_TYPE;
  fiber.lanes = lanes;
  return fiber;
}

export function createHostRootFiber(): Fiber {
  return createFiber(HostRoot, null, null);
}

// Double buffering: creates a work-in-progress fiber from the current fiber
export function createWorkInProgress(current: Fiber, pendingProps: unknown): Fiber {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // Create a new fiber
    workInProgress = createFiber(current.tag, pendingProps, current.key);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;

    // Reset effects
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // Reset all effects except static ones
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;

  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // Clone the dependencies object
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          lanes: currentDependencies.lanes,
          firstContext: currentDependencies.firstContext,
        };

  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;
  workInProgress.refCleanup = current.refCleanup;

  return workInProgress;
}
