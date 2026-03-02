import type { Fiber } from "./ReactFiberTypes.js";
import type { Lanes } from "./ReactFiberLane.js";
import type { ReactElement } from "../react/ReactTypes.js";
import { ChildDeletion, Placement } from "./ReactFiberFlags.js";
import { Fragment, HostText } from "./ReactWorkTags.js";
import {
  getIteratorFn,
  REACT_ELEMENT_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_LAZY_TYPE,
} from "../react/ReactSymbols.js";
import {
  createFiberFromElement,
  createFiberFromFragment,
  createFiberFromText,
  createWorkInProgress,
} from "./ReactFiber.js";

function coerceRef(fiber: Fiber, element: ReactElement): void {
  const ref = element.ref;
  if (ref !== null && ref !== undefined) {
    fiber.ref = ref;
  }
}

// Creates the child fiber reconciler functions as a closure over shouldTrackSideEffects
function createChildReconciler(shouldTrackSideEffects: boolean) {
  function deleteChild(returnFiber: Fiber, childToDelete: Fiber): void {
    if (!shouldTrackSideEffects) {
      return;
    }
    const deletions = returnFiber.deletions;
    if (deletions === null) {
      returnFiber.deletions = [childToDelete];
      returnFiber.flags |= ChildDeletion;
    } else {
      deletions.push(childToDelete);
    }
  }

  function deleteRemainingChildren(returnFiber: Fiber, currentFirstChild: Fiber | null): null {
    if (!shouldTrackSideEffects) {
      return null;
    }
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  function mapRemainingChildren(currentFirstChild: Fiber): Map<string | number, Fiber> {
    const existingChildren: Map<string | number, Fiber> = new Map();
    let existingChild: Fiber | null = currentFirstChild;
    while (existingChild !== null) {
      if (existingChild.key === null) {
        existingChildren.set(existingChild.index, existingChild);
      } else {
        existingChildren.set(existingChild.key, existingChild);
      }
      existingChild = existingChild.sibling;
    }
    return existingChildren;
  }

  function reuseFiber(fiber: Fiber, pendingProps: unknown): Fiber {
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  function placeChild(newFiber: Fiber, lastPlacedIndex: number, newIndex: number): number {
    newFiber.index = newIndex;
    if (!shouldTrackSideEffects) {
      return lastPlacedIndex;
    }
    const current = newFiber.alternate;
    if (current !== null) {
      const oldIndex = current.index;
      if (oldIndex < lastPlacedIndex) {
        // This is a move.
        newFiber.flags |= Placement;
        return lastPlacedIndex;
      } else {
        return oldIndex;
      }
    } else {
      // This is an insertion.
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    }
  }

  function placeSingleChild(newFiber: Fiber): Fiber {
    if (shouldTrackSideEffects && newFiber.alternate === null) {
      newFiber.flags |= Placement;
    }
    return newFiber;
  }

  // Create a fiber from a child element (dispatch by type)
  function createChild(returnFiber: Fiber, newChild: unknown, lanes: Lanes): Fiber | null {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      const created = createFiberFromText("" + newChild, lanes);
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch ((newChild as Record<string, unknown>).$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const created = createFiberFromElement(newChild as ReactElement, lanes);
          coerceRef(created, newChild as ReactElement);
          created.return = returnFiber;
          return created;
        }
        case REACT_LAZY_TYPE: {
          const payload = (newChild as Record<string, unknown>)._payload;
          const init = (newChild as Record<string, unknown>)._init as (payload: unknown) => unknown;
          return createChild(returnFiber, init(payload), lanes);
        }
      }

      if (Array.isArray(newChild)) {
        const created = createFiberFromFragment(newChild, lanes, null);
        created.return = returnFiber;
        return created;
      }

      const iteratorFn = getIteratorFn(newChild);
      if (iteratorFn) {
        const iterator = iteratorFn.call(newChild);
        const arr: unknown[] = [];
        let step = iterator.next();
        while (!step.done) {
          arr.push(step.value);
          step = iterator.next();
        }
        const created = createFiberFromFragment(arr, lanes, null);
        created.return = returnFiber;
        return created;
      }
    }

    return null;
  }

  function updateSlot(
    returnFiber: Fiber,
    oldFiber: Fiber | null,
    newChild: unknown,
    lanes: Lanes,
  ): Fiber | null {
    const key = oldFiber !== null ? oldFiber.key : null;

    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      if (key !== null) {
        return null;
      }
      return updateTextNode(returnFiber, oldFiber, "" + newChild, lanes);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch ((newChild as Record<string, unknown>).$$typeof) {
        case REACT_ELEMENT_TYPE: {
          if ((newChild as ReactElement).key === key) {
            return updateElement(returnFiber, oldFiber, newChild as ReactElement, lanes);
          } else {
            return null;
          }
        }
        case REACT_LAZY_TYPE: {
          const payload = (newChild as Record<string, unknown>)._payload;
          const init = (newChild as Record<string, unknown>)._init as (payload: unknown) => unknown;
          return updateSlot(returnFiber, oldFiber, init(payload), lanes);
        }
      }

      if (Array.isArray(newChild)) {
        if (key !== null) {
          return null;
        }
        return updateFragment(returnFiber, oldFiber, newChild, lanes, null);
      }
    }

    return null;
  }

  function updateFromMap(
    existingChildren: Map<string | number, Fiber>,
    returnFiber: Fiber,
    newIdx: number,
    newChild: unknown,
    lanes: Lanes,
  ): Fiber | null {
    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      const matchedFiber = existingChildren.get(newIdx) || null;
      return updateTextNode(returnFiber, matchedFiber, "" + newChild, lanes);
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch ((newChild as Record<string, unknown>).$$typeof) {
        case REACT_ELEMENT_TYPE: {
          const el = newChild as ReactElement;
          const matchedFiber = existingChildren.get(el.key === null ? newIdx : el.key) || null;
          return updateElement(returnFiber, matchedFiber, el, lanes);
        }
        case REACT_LAZY_TYPE: {
          const payload = (newChild as Record<string, unknown>)._payload;
          const init = (newChild as Record<string, unknown>)._init as (payload: unknown) => unknown;
          return updateFromMap(existingChildren, returnFiber, newIdx, init(payload), lanes);
        }
      }

      if (Array.isArray(newChild)) {
        const matchedFiber = existingChildren.get(newIdx) || null;
        return updateFragment(returnFiber, matchedFiber, newChild, lanes, null);
      }
    }

    return null;
  }

  function updateTextNode(
    returnFiber: Fiber,
    current: Fiber | null,
    textContent: string,
    lanes: Lanes,
  ): Fiber {
    if (current === null || current.tag !== HostText) {
      const created = createFiberFromText(textContent, lanes);
      created.return = returnFiber;
      return created;
    } else {
      const existing = reuseFiber(current, textContent);
      existing.return = returnFiber;
      return existing;
    }
  }

  function updateElement(
    returnFiber: Fiber,
    current: Fiber | null,
    element: ReactElement,
    lanes: Lanes,
  ): Fiber {
    const elementType = element.type;
    if (elementType === REACT_FRAGMENT_TYPE) {
      return updateFragment(
        returnFiber,
        current,
        (element.props as Record<string, unknown>).children,
        lanes,
        element.key,
      );
    }
    if (current !== null) {
      if (current.elementType === elementType) {
        const existing = reuseFiber(current, element.props);
        coerceRef(existing, element);
        existing.return = returnFiber;
        return existing;
      }
    }
    const created = createFiberFromElement(element, lanes);
    coerceRef(created, element);
    created.return = returnFiber;
    return created;
  }

  function updateFragment(
    returnFiber: Fiber,
    current: Fiber | null,
    fragment: unknown,
    lanes: Lanes,
    key: string | null,
  ): Fiber {
    if (current === null || current.tag !== Fragment) {
      const created = createFiberFromFragment(fragment, lanes, key);
      created.return = returnFiber;
      return created;
    } else {
      const existing = reuseFiber(current, fragment);
      existing.return = returnFiber;
      return existing;
    }
  }

  function reconcileSingleElement(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    element: ReactElement,
    lanes: Lanes,
  ): Fiber {
    const key = element.key;
    let child = currentFirstChild;
    while (child !== null) {
      if (child.key === key) {
        const elementType = element.type;
        if (elementType === REACT_FRAGMENT_TYPE) {
          if (child.tag === Fragment) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = reuseFiber(child, (element.props as Record<string, unknown>).children);
            existing.return = returnFiber;
            return existing;
          }
        } else {
          if (child.elementType === elementType) {
            deleteRemainingChildren(returnFiber, child.sibling);
            const existing = reuseFiber(child, element.props);
            coerceRef(existing, element);
            existing.return = returnFiber;
            return existing;
          }
        }
        deleteRemainingChildren(returnFiber, child);
        break;
      } else {
        deleteChild(returnFiber, child);
      }
      child = child.sibling;
    }

    if (element.type === REACT_FRAGMENT_TYPE) {
      const created = createFiberFromFragment(
        (element.props as Record<string, unknown>).children,
        lanes,
        element.key,
      );
      created.return = returnFiber;
      return created;
    } else {
      const created = createFiberFromElement(element, lanes);
      coerceRef(created, element);
      created.return = returnFiber;
      return created;
    }
  }

  function reconcileSingleTextNode(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    textContent: string,
    lanes: Lanes,
  ): Fiber {
    if (currentFirstChild !== null && currentFirstChild.tag === HostText) {
      deleteRemainingChildren(returnFiber, currentFirstChild.sibling);
      const existing = reuseFiber(currentFirstChild, textContent);
      existing.return = returnFiber;
      return existing;
    }
    deleteRemainingChildren(returnFiber, currentFirstChild);
    const created = createFiberFromText(textContent, lanes);
    created.return = returnFiber;
    return created;
  }

  function reconcileChildrenArray(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChildren: Array<unknown>,
    lanes: Lanes,
  ): Fiber | null {
    let resultingFirstChild: Fiber | null = null;
    let previousNewFiber: Fiber | null = null;

    let oldFiber = currentFirstChild;
    let lastPlacedIndex = 0;
    let newIdx = 0;
    let nextOldFiber = null;

    // First pass: walk both lists in parallel
    for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
      if (oldFiber.index > newIdx) {
        nextOldFiber = oldFiber;
        oldFiber = null;
      } else {
        nextOldFiber = oldFiber.sibling;
      }
      const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);
      if (newFiber === null) {
        if (oldFiber === null) {
          oldFiber = nextOldFiber;
        }
        break;
      }
      if (shouldTrackSideEffects) {
        if (oldFiber && newFiber.alternate === null) {
          deleteChild(returnFiber, oldFiber);
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (previousNewFiber === null) {
        resultingFirstChild = newFiber;
      } else {
        previousNewFiber.sibling = newFiber;
      }
      previousNewFiber = newFiber;
      oldFiber = nextOldFiber;
    }

    if (newIdx === newChildren.length) {
      deleteRemainingChildren(returnFiber, oldFiber);
      return resultingFirstChild;
    }

    if (oldFiber === null) {
      for (; newIdx < newChildren.length; newIdx++) {
        const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
        if (newFiber === null) {
          continue;
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
      return resultingFirstChild;
    }

    // Second pass: use a map for lookups
    const existingChildren = mapRemainingChildren(oldFiber);

    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = updateFromMap(
        existingChildren,
        returnFiber,
        newIdx,
        newChildren[newIdx],
        lanes,
      );
      if (newFiber !== null) {
        if (shouldTrackSideEffects) {
          const currentFiber = newFiber.alternate;
          if (currentFiber !== null) {
            existingChildren.delete(currentFiber.key === null ? newIdx : currentFiber.key);
          }
        }
        lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
        if (previousNewFiber === null) {
          resultingFirstChild = newFiber;
        } else {
          previousNewFiber.sibling = newFiber;
        }
        previousNewFiber = newFiber;
      }
    }

    if (shouldTrackSideEffects) {
      existingChildren.forEach((child) => deleteChild(returnFiber, child));
    }

    return resultingFirstChild;
  }

  function reconcileChildFibers(
    returnFiber: Fiber,
    currentFirstChild: Fiber | null,
    newChild: unknown,
    lanes: Lanes,
  ): Fiber | null {
    // Handle top-level unkeyed fragments as arrays
    if (
      typeof newChild === "object" &&
      newChild !== null &&
      (newChild as Record<string, unknown>).type === REACT_FRAGMENT_TYPE &&
      (newChild as ReactElement).key === null
    ) {
      newChild = ((newChild as ReactElement).props as Record<string, unknown>).children;
    }

    if (typeof newChild === "object" && newChild !== null) {
      switch ((newChild as Record<string, unknown>).$$typeof) {
        case REACT_ELEMENT_TYPE:
          return placeSingleChild(
            reconcileSingleElement(returnFiber, currentFirstChild, newChild as ReactElement, lanes),
          );
        case REACT_LAZY_TYPE: {
          const payload = (newChild as Record<string, unknown>)._payload;
          const init = (newChild as Record<string, unknown>)._init as (payload: unknown) => unknown;
          return reconcileChildFibers(returnFiber, currentFirstChild, init(payload), lanes);
        }
      }

      if (Array.isArray(newChild)) {
        return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
      }

      const iteratorFn = getIteratorFn(newChild);
      if (iteratorFn) {
        const iterator = iteratorFn.call(newChild);
        const arr: unknown[] = [];
        let step = iterator.next();
        while (!step.done) {
          arr.push(step.value);
          step = iterator.next();
        }
        return reconcileChildrenArray(returnFiber, currentFirstChild, arr, lanes);
      }
    }

    if (
      (typeof newChild === "string" && newChild !== "") ||
      typeof newChild === "number" ||
      typeof newChild === "bigint"
    ) {
      return placeSingleChild(
        reconcileSingleTextNode(returnFiber, currentFirstChild, "" + newChild, lanes),
      );
    }

    return deleteRemainingChildren(returnFiber, currentFirstChild);
  }

  return reconcileChildFibers;
}

export const reconcileChildFibers = createChildReconciler(true);
export const mountChildFibers = createChildReconciler(false);

export function cloneChildFibers(_current: Fiber | null, workInProgress: Fiber): void {
  if (workInProgress.child === null) {
    return;
  }

  let currentChild = workInProgress.child;
  let newChild = createWorkInProgress(currentChild, currentChild.pendingProps);
  workInProgress.child = newChild;
  newChild.return = workInProgress;

  while (currentChild.sibling !== null) {
    currentChild = currentChild.sibling;
    newChild = newChild.sibling = createWorkInProgress(currentChild, currentChild.pendingProps);
    newChild.return = workInProgress;
  }
  newChild.sibling = null;
}
