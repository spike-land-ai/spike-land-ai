import type { ReactElement, ReactNode } from "./ReactTypes.js";
import {
  getIteratorFn,
  REACT_ELEMENT_TYPE,
  REACT_LAZY_TYPE,
  REACT_PORTAL_TYPE,
} from "./ReactSymbols.js";
import { cloneAndReplaceKey, isValidElement } from "./ReactElement.js";

const SEPARATOR = ".";
const SUBSEPARATOR = ":";

function escape(key: string): string {
  const escapeRegex = /[=:]/g;
  const escaperLookup: Record<string, string> = {
    "=": "=0",
    ":": "=2",
  };
  const escapedString = key.replace(escapeRegex, function (match) {
    return escaperLookup[match] ?? match;
  });
  return "$" + escapedString;
}

const userProvidedKeyEscapeRegex = /\/+/g;
function escapeUserProvidedKey(text: string): string {
  return text.replace(userProvidedKeyEscapeRegex, "$&/");
}

function getElementKey(element: unknown, index: number): string {
  if (
    typeof element === "object" &&
    element !== null &&
    (element as Record<string, unknown>).key != null
  ) {
    return escape("" + (element as Record<string, unknown>).key);
  }
  return index.toString(36);
}

function resolveThenable<T>(
  thenable: PromiseLike<T> & { status?: string; value?: T; reason?: unknown },
): T {
  switch (thenable.status) {
    case "fulfilled": {
      return (thenable as unknown as { value: T }).value;
    }
    case "rejected": {
      throw (thenable as unknown as { reason: unknown }).reason;
    }
    default: {
      if (typeof thenable.status === "string") {
        thenable.then(
          () => {},
          () => {},
        );
      } else {
        const pendingThenable = thenable as unknown as {
          status: string;
          value?: T;
          reason?: unknown;
          then: PromiseLike<T>["then"];
        };
        pendingThenable.status = "pending";
        pendingThenable.then(
          (fulfilledValue: unknown) => {
            if (pendingThenable.status === "pending") {
              pendingThenable.status = "fulfilled";
              pendingThenable.value = fulfilledValue as T;
            }
          },
          (error: unknown) => {
            if (pendingThenable.status === "pending") {
              pendingThenable.status = "rejected";
              pendingThenable.reason = error;
            }
          },
        );
      }

      switch ((thenable as unknown as { status: string }).status) {
        case "fulfilled": {
          return (thenable as unknown as { value: T }).value;
        }
        case "rejected": {
          throw (thenable as unknown as { reason: unknown }).reason;
        }
      }
    }
  }
  throw thenable;
}

function mapIntoArray(
  children: unknown,
  array: unknown[],
  escapedPrefix: string,
  nameSoFar: string,
  callback: (child: unknown) => unknown,
): number {
  const type = typeof children;

  if (type === "undefined" || type === "boolean") {
    children = null;
  }

  let invokeCallback = false;

  if (children === null) {
    invokeCallback = true;
  } else {
    switch (type) {
      case "bigint":
      case "string":
      case "number":
        invokeCallback = true;
        break;
      case "object":
        switch ((children as unknown as { $$typeof: symbol }).$$typeof) {
          case REACT_ELEMENT_TYPE:
          case REACT_PORTAL_TYPE:
            invokeCallback = true;
            break;
          case REACT_LAZY_TYPE: {
            const payload = (children as unknown as { _payload: unknown })._payload;
            const init = (children as unknown as { _init: (payload: unknown) => unknown })._init;
            return mapIntoArray(init(payload), array, escapedPrefix, nameSoFar, callback);
          }
        }
    }
  }

  if (invokeCallback) {
    const child = children;
    let mappedChild = callback(child);
    const childKey = nameSoFar === "" ? SEPARATOR + getElementKey(child, 0) : nameSoFar;
    if (Array.isArray(mappedChild)) {
      let escapedChildKey = "";
      if (childKey != null) {
        escapedChildKey = escapeUserProvidedKey(childKey) + "/";
      }
      mapIntoArray(mappedChild, array, escapedChildKey, "", (c) => c);
    } else if (mappedChild != null) {
      if (isValidElement(mappedChild)) {
        const newChild = cloneAndReplaceKey(
          mappedChild,
          escapedPrefix +
            (mappedChild.key != null &&
            (!child || (child as Record<string, unknown>).key !== mappedChild.key)
              ? escapeUserProvidedKey("" + mappedChild.key) + "/"
              : "") +
            childKey,
        );
        mappedChild = newChild;
      }
      array.push(mappedChild);
    }
    return 1;
  }

  let child;
  let nextName;
  let subtreeCount = 0;
  const nextNamePrefix = nameSoFar === "" ? SEPARATOR : nameSoFar + SUBSEPARATOR;

  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      child = children[i];
      nextName = nextNamePrefix + getElementKey(child, i);
      subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
    }
  } else {
    const iteratorFn = getIteratorFn(children);
    if (typeof iteratorFn === "function") {
      const iterator = iteratorFn.call(children);
      let step;
      let ii = 0;
      while (!(step = iterator.next()).done) {
        child = step.value;
        nextName = nextNamePrefix + getElementKey(child, ii++);
        subtreeCount += mapIntoArray(child, array, escapedPrefix, nextName, callback);
      }
    } else if (type === "object") {
      if (typeof (children as unknown as { then?: unknown }).then === "function") {
        return mapIntoArray(
          resolveThenable(
            children as PromiseLike<unknown> & {
              status?: string;
              value?: unknown;
              reason?: unknown;
            },
          ),
          array,
          escapedPrefix,
          nameSoFar,
          callback,
        );
      }

      const childrenString = String(children);
      throw new Error(
        `Objects are not valid as a React child (found: ${
          childrenString === "[object Object]"
            ? "object with keys {" +
              Object.keys(children as Record<string, unknown>).join(", ") +
              "}"
            : childrenString
        }). ` +
          "If you meant to render a collection of children, use an array " +
          "instead.",
      );
    }
  }

  return subtreeCount;
}

export function mapChildren(
  children: ReactNode,
  func: (child: ReactNode, index: number) => ReactNode,
  context?: unknown,
): ReactNode[] | null | undefined {
  if (children == null) {
    return children as null | undefined;
  }
  const result: ReactNode[] = [];
  let count = 0;
  mapIntoArray(children, result, "", "", function (child) {
    return func.call(context, child as ReactNode, count++);
  });
  return result;
}

export function forEachChildren(
  children: ReactNode,
  forEachFunc: (child: ReactNode, index: number) => void,
  forEachContext?: unknown,
): void {
  mapChildren(
    children,
    function (this: unknown, ...args: unknown[]) {
      forEachFunc.apply(this as undefined, args as [ReactNode, number]);
    } as (child: ReactNode, index: number) => ReactNode,
    forEachContext,
  );
}

export function countChildren(children: ReactNode): number {
  let n = 0;
  mapChildren(children, () => {
    n++;
    return null;
  });
  return n;
}

export function toArray(children: ReactNode): ReactNode[] {
  return mapChildren(children, (child) => child) || [];
}

export function onlyChild(children: ReactNode): ReactElement {
  if (!isValidElement(children)) {
    throw new Error("React.Children.only expected to receive a single React element child.");
  }
  return children as ReactElement;
}
