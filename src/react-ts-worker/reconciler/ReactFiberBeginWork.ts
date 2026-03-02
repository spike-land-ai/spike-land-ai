// BeginWork - Render phase down-traversal
// Processes each fiber and returns the next child to work on

import type { Fiber } from "./ReactFiberTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import type { ComponentClass, ComponentInstance, ReactContext } from "../react/ReactTypes.js";
import {
  ClassComponent,
  ContextProvider,
  ForwardRef,
  Fragment,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  LazyComponent,
  MemoComponent,
  SimpleMemoComponent,
  SuspenseComponent,
} from "./ReactWorkTags.js";
import {
  ContentReset,
  DidCapture,
  NoFlags,
  PerformedWork,
  Ref,
  RefStatic,
} from "./ReactFiberFlags.js";
import { includesSomeLane, NoLanes } from "./ReactFiberLane.js";
import {
  REACT_ELEMENT_TYPE,
  REACT_FORWARD_REF_TYPE,
  REACT_MEMO_TYPE,
} from "../react/ReactSymbols.js";
import { cloneChildFibers, mountChildFibers, reconcileChildFibers } from "./ReactChildFiber.js";
import { bailoutHooks, renderWithHooks } from "./ReactFiberHooks.js";
import { pushProvider } from "./ReactFiberNewContext.js";
import { pushHostContainer, pushHostContext } from "./ReactFiberHostContext.js";
import {
  constructClassInstance,
  mountClassInstance,
  updateClassInstance,
} from "./ReactFiberClassComponent.js";
import { createFiberFromElement } from "./ReactFiber.js";
import shallowEqual from "../shared/shallowEqual.js";

function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: unknown,
  renderLanes: Lanes,
): void {
  if (current === null) {
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes,
    );
  }
}

function markRef(current: Fiber | null, workInProgress: Fiber): void {
  const ref = workInProgress.ref;
  if ((current === null && ref !== null) || (current !== null && current.ref !== ref)) {
    workInProgress.flags |= Ref;
    workInProgress.flags |= RefStatic;
  }
}

function updateFunctionComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: (...args: unknown[]) => unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    Component,
    nextProps,
    null,
    renderLanes,
  );

  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateClassComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  const Ctor = Component as ComponentClass;
  let instance = workInProgress.stateNode as ComponentInstance | null;

  if (instance === null) {
    instance = constructClassInstance(workInProgress, Ctor, nextProps);
    mountClassInstance(workInProgress, Ctor, nextProps, renderLanes);
  } else if (current === null) {
    // Re-mount (component was previously deleted but fiber is being reused)
    mountClassInstance(workInProgress, Ctor, nextProps, renderLanes);
  } else {
    const shouldUpdate = updateClassInstance(current, workInProgress, Ctor, nextProps, renderLanes);
    if (!shouldUpdate) {
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  const nextChildren = instance!.render();
  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostRoot(current: Fiber, workInProgress: Fiber, renderLanes: Lanes): Fiber | null {
  pushHostContainer(workInProgress);

  const nextChildren =
    (workInProgress.memoizedState as Record<string, unknown> | null)?.element ?? null;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  pushHostContext(workInProgress);

  const nextProps = workInProgress.pendingProps as Record<string, unknown>;
  const prevProps =
    current !== null ? (current.memoizedProps as Record<string, unknown> | null) : null;

  let nextChildren = nextProps.children;

  // Check if the host config says this component should set text content
  const isDirectTextChild = typeof nextChildren === "string" || typeof nextChildren === "number";

  if (isDirectTextChild) {
    nextChildren = null;
  } else if (prevProps !== null) {
    const prevIsDirectTextChild =
      typeof prevProps.children === "string" || typeof prevProps.children === "number";
    if (prevIsDirectTextChild) {
      workInProgress.flags |= ContentReset;
    }
  }

  markRef(current, workInProgress);
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateHostText(_current: Fiber | null, _workInProgress: Fiber): null {
  // Nothing to do for text nodes in beginWork
  return null;
}

function updateFragment(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const nextChildren = workInProgress.pendingProps;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateContextProvider(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const context: ReactContext<unknown> = workInProgress.type as ReactContext<unknown>;
  const newProps = workInProgress.pendingProps as Record<string, unknown>;
  const newValue = newProps.value;

  pushProvider(workInProgress, context, newValue);

  const newChildren = newProps.children;
  reconcileChildren(current, workInProgress, newChildren, renderLanes);
  return workInProgress.child;
}

function updateForwardRef(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  const render = (Component as Record<string, unknown>).render as (
    props: unknown,
    secondArg?: unknown,
  ) => unknown;
  const ref = workInProgress.ref;

  const nextChildren = renderWithHooks(
    current,
    workInProgress,
    render,
    nextProps,
    ref,
    renderLanes,
  );

  if (current !== null && !didReceiveUpdate) {
    bailoutHooks(current, workInProgress, renderLanes);
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  workInProgress.flags |= PerformedWork;
  reconcileChildren(current, workInProgress, nextChildren, renderLanes);
  return workInProgress.child;
}

function updateMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  const comp = Component as Record<string, unknown>;
  if (current === null) {
    const innerType = comp.type;
    if (
      typeof innerType === "function" &&
      comp.compare === null &&
      comp.defaultProps === undefined
    ) {
      // Simple memo shortcut
      workInProgress.tag = SimpleMemoComponent;
      workInProgress.type = innerType;
      return updateSimpleMemoComponent(current, workInProgress, innerType, nextProps, renderLanes);
    }

    const child = createFiberFromElement(
      {
        $$typeof: REACT_ELEMENT_TYPE,
        type: innerType as string | ((...args: unknown[]) => unknown),
        key: null,
        ref: null,
        props: nextProps,
        _owner: null,
      },
      renderLanes,
    );
    child.ref = workInProgress.ref;
    child.return = workInProgress;
    workInProgress.child = child;
    return child;
  }

  // Update path
  const currentChild = current.child!;
  const prevProps = currentChild.memoizedProps;
  const compare = (comp.compare || shallowEqual) as (a: unknown, b: unknown) => boolean;

  if (compare(prevProps, nextProps) && current.ref === workInProgress.ref) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  workInProgress.flags |= PerformedWork;
  const newChild = createFiberFromElement(
    {
      $$typeof: REACT_ELEMENT_TYPE,
      type: comp.type as string | ((...args: unknown[]) => unknown),
      key: null,
      ref: null,
      props: nextProps,
      _owner: null,
    },
    renderLanes,
  );
  newChild.ref = workInProgress.ref;
  newChild.return = workInProgress;
  workInProgress.child = newChild;
  return newChild;
}

function updateSimpleMemoComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  if (current !== null) {
    const prevProps = current.memoizedProps;
    if (shallowEqual(prevProps, nextProps) && current.ref === workInProgress.ref) {
      didReceiveUpdate = false;
      workInProgress.pendingProps = nextProps = prevProps;
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }
  return updateFunctionComponent(
    current,
    workInProgress,
    Component as (...args: unknown[]) => unknown,
    nextProps,
    renderLanes,
  );
}

function updateSuspenseComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  const nextProps = workInProgress.pendingProps as Record<string, unknown>;

  const showFallback = (workInProgress.flags & DidCapture) !== NoFlags;

  if (showFallback) {
    workInProgress.flags &= ~DidCapture;
    const fallback = nextProps.fallback;
    // Render fallback
    reconcileChildren(current, workInProgress, fallback, renderLanes);
    return workInProgress.child;
  }

  // Normal render - show primary content
  const primaryChildren = nextProps.children;
  reconcileChildren(current, workInProgress, primaryChildren, renderLanes);
  return workInProgress.child;
}

function updateLazyComponent(
  current: Fiber | null,
  workInProgress: Fiber,
  lazyComponent: unknown,
  nextProps: unknown,
  renderLanes: Lanes,
): Fiber | null {
  const payload = (lazyComponent as Record<string, unknown>)._payload;
  const init = (lazyComponent as Record<string, unknown>)._init as (payload: unknown) => unknown;
  const Component = init(payload);

  workInProgress.type = Component;

  if (typeof Component === "function") {
    if (isClassComponent(Component)) {
      workInProgress.tag = ClassComponent;
      return updateClassComponent(current, workInProgress, Component, nextProps, renderLanes);
    }
    workInProgress.tag = FunctionComponent;
    return updateFunctionComponent(
      current,
      workInProgress,
      Component as (...args: unknown[]) => unknown,
      nextProps,
      renderLanes,
    );
  }

  if (typeof Component === "object" && Component !== null) {
    if ((Component as Record<string, unknown>).$$typeof === REACT_FORWARD_REF_TYPE) {
      workInProgress.tag = ForwardRef;
      return updateForwardRef(current, workInProgress, Component, nextProps, renderLanes);
    }
    if ((Component as Record<string, unknown>).$$typeof === REACT_MEMO_TYPE) {
      workInProgress.tag = MemoComponent;
      return updateMemoComponent(current, workInProgress, Component, nextProps, renderLanes);
    }
  }

  throw new Error(
    `Element type is invalid. Received a promise that resolves to: ${Component}. ` +
      "Lazy element type must resolve to a class or function.",
  );
}

function isClassComponent(Component: unknown): boolean {
  const proto = (Component as Record<string, unknown>).prototype as
    | Record<string, unknown>
    | undefined;
  return !!(proto && proto.isReactComponent);
}

// Track whether we received an update during this beginWork
let didReceiveUpdate = false;

export function markWorkInProgressReceivedUpdate(): void {
  didReceiveUpdate = true;
}

function bailoutOnAlreadyFinishedWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  if (!includesSomeLane(workInProgress.childLanes, renderLanes)) {
    // No pending work in children
    return null;
  }

  // Clone children - this fiber doesn't need work but children might
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}

export function beginWork(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): Fiber | null {
  didReceiveUpdate = false;

  // Check if we can bail out
  if (current !== null) {
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    if (oldProps !== newProps) {
      didReceiveUpdate = true;
    } else if (!includesSomeLane(renderLanes, workInProgress.lanes)) {
      didReceiveUpdate = false;
      // Push contexts as needed even during bailout
      switch (workInProgress.tag) {
        case HostRoot:
          pushHostContainer(workInProgress);
          break;
        case HostComponent:
          pushHostContext(workInProgress);
          break;
        case ContextProvider: {
          const context: ReactContext<unknown> = workInProgress.type as ReactContext<unknown>;
          pushProvider(
            workInProgress,
            context,
            (workInProgress.memoizedProps as Record<string, unknown>).value,
          );
          break;
        }
      }
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
  }

  // Clear lanes before processing - they'll be set again if needed
  workInProgress.lanes = NoLanes;

  switch (workInProgress.tag) {
    case FunctionComponent: {
      const Component = workInProgress.type as (...args: unknown[]) => unknown;
      const unresolvedProps = workInProgress.pendingProps;
      return updateFunctionComponent(
        current,
        workInProgress,
        Component,
        unresolvedProps,
        renderLanes,
      );
    }
    case ClassComponent: {
      const Component = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      return updateClassComponent(current, workInProgress, Component, unresolvedProps, renderLanes);
    }
    case HostRoot:
      return updateHostRoot(current!, workInProgress, renderLanes);
    case HostComponent:
      return updateHostComponent(current, workInProgress, renderLanes);
    case HostText:
      return updateHostText(current, workInProgress);
    case Fragment:
      return updateFragment(current, workInProgress, renderLanes);
    case ContextProvider:
      return updateContextProvider(current, workInProgress, renderLanes);
    case ForwardRef: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      return updateForwardRef(current, workInProgress, type, unresolvedProps, renderLanes);
    }
    case MemoComponent: {
      const type = workInProgress.type;
      const unresolvedProps = workInProgress.pendingProps;
      return updateMemoComponent(current, workInProgress, type, unresolvedProps, renderLanes);
    }
    case SimpleMemoComponent:
      return updateSimpleMemoComponent(
        current,
        workInProgress,
        workInProgress.type,
        workInProgress.pendingProps,
        renderLanes,
      );
    case SuspenseComponent:
      return updateSuspenseComponent(current, workInProgress, renderLanes);
    case LazyComponent: {
      const elementType = workInProgress.elementType;
      return updateLazyComponent(
        current,
        workInProgress,
        elementType,
        workInProgress.pendingProps,
        renderLanes,
      );
    }
    default:
      throw new Error(`Unknown work tag: ${workInProgress.tag}`);
  }
}
