import type { LazyComponent, LazyPayload } from "./ReactTypes.js";
import { REACT_LAZY_TYPE } from "./ReactSymbols.js";

const Uninitialized = -1;
const Pending = 0;
const Resolved = 1;
const Rejected = 2;

function lazyInitializer<T>(payload: LazyPayload<T>): T {
  if (payload._status === Uninitialized) {
    const ctor = payload._result as () => PromiseLike<{ default: T }>;
    const thenable = ctor();
    thenable.then(
      (moduleObject: { default: T }) => {
        if (payload._status === Pending || payload._status === Uninitialized) {
          (payload as unknown as { _status: number })._status = Resolved;
          (payload as unknown as { _result: unknown })._result = moduleObject;
        }
      },
      (error: unknown) => {
        if (payload._status === Pending || payload._status === Uninitialized) {
          (payload as unknown as { _status: number })._status = Rejected;
          (payload as unknown as { _result: unknown })._result = error;
        }
      },
    );
    if (payload._status === Uninitialized) {
      (payload as unknown as { _status: number })._status = Pending;
      (payload as unknown as { _result: unknown })._result = thenable;
    }
  }
  if (payload._status === Resolved) {
    const moduleObject = payload._result as { default: T };
    return moduleObject.default;
  } else {
    throw payload._result;
  }
}

export function lazy<T>(ctor: () => PromiseLike<{ default: T }>): LazyComponent<T> {
  const payload: LazyPayload<T> = {
    _status: Uninitialized,
    _result: ctor as unknown as T | PromiseLike<T> | ((payload: LazyPayload<T>) => T),
  };

  const lazyType: LazyComponent<T> = {
    $$typeof: REACT_LAZY_TYPE,
    _payload: payload,
    _init: lazyInitializer,
  };

  return lazyType;
}
