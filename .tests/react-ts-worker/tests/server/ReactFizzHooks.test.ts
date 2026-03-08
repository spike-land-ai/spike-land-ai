import { beforeEach, describe, expect, it } from "vitest";
import {
  resetIdCounter,
  ServerDispatcher,
} from "../../../../src/core/react-engine/server/ReactFizzHooks.js";
import { createContext } from "../../../../src/core/react-engine/react/ReactContext.js";

describe("ReactFizzHooks - ServerDispatcher", () => {
  beforeEach(() => {
    resetIdCounter();
  });

  describe("resetIdCounter", () => {
    it("resets the ID counter", () => {
      const id1 = ServerDispatcher.useId();
      const id2 = ServerDispatcher.useId();
      expect(id1).not.toBe(id2);

      resetIdCounter();
      const id3 = ServerDispatcher.useId();
      expect(id3).toBe(id1); // Same as first after reset
    });
  });

  describe("useState", () => {
    it("returns initial value", () => {
      const [state] = ServerDispatcher.useState(42);
      expect(state).toBe(42);
    });

    it("calls initializer function when function passed", () => {
      const [state] = ServerDispatcher.useState(() => "computed");
      expect(state).toBe("computed");
    });

    it("returns no-op setter", () => {
      const [, setter] = ServerDispatcher.useState(0);
      expect(() => setter(1)).not.toThrow();
    });
  });

  describe("useReducer", () => {
    it("returns initial arg without init", () => {
      const [state] = ServerDispatcher.useReducer((s: number) => s, 10);
      expect(state).toBe(10);
    });

    it("calls init function when provided", () => {
      const [state] = ServerDispatcher.useReducer(
        (s: number) => s,
        5,
        (s: number) => s * 2,
      );
      expect(state).toBe(10);
    });

    it("returns no-op dispatch", () => {
      const [, dispatch] = ServerDispatcher.useReducer((s: number) => s, 0);
      expect(() => dispatch(1)).not.toThrow();
    });
  });

  describe("useEffect", () => {
    it("is a no-op", () => {
      expect(() => ServerDispatcher.useEffect(() => {}, [])).not.toThrow();
    });
  });

  describe("useLayoutEffect", () => {
    it("is a no-op", () => {
      expect(() => ServerDispatcher.useLayoutEffect(() => {}, [])).not.toThrow();
    });
  });

  describe("useInsertionEffect", () => {
    it("is a no-op", () => {
      expect(() => ServerDispatcher.useInsertionEffect(() => {}, [])).not.toThrow();
    });
  });

  describe("useCallback", () => {
    it("returns the callback as-is", () => {
      const cb = () => 42;
      const result = ServerDispatcher.useCallback(cb, []);
      expect(result).toBe(cb);
    });
  });

  describe("useMemo", () => {
    it("calls create and returns value", () => {
      const result = ServerDispatcher.useMemo(() => "computed", []);
      expect(result).toBe("computed");
    });
  });

  describe("useRef", () => {
    it("returns ref object with initial value", () => {
      const ref = ServerDispatcher.useRef(42);
      expect(ref.current).toBe(42);
    });

    it("returns ref with null", () => {
      const ref = ServerDispatcher.useRef(null);
      expect(ref.current).toBeNull();
    });
  });

  describe("useContext", () => {
    it("returns the current context value", () => {
      const ctx = createContext("default");
      const value = ServerDispatcher.useContext(ctx);
      expect(value).toBe("default");
    });

    it("returns updated value", () => {
      const ctx = createContext("initial");
      ctx._currentValue = "updated";
      const value = ServerDispatcher.useContext(ctx);
      expect(value).toBe("updated");
      ctx._currentValue = "initial"; // restore
    });
  });

  describe("useImperativeHandle", () => {
    it("is a no-op", () => {
      const ref = { current: null };
      expect(() => ServerDispatcher.useImperativeHandle(ref, () => ({}), [])).not.toThrow();
    });
  });

  describe("useDebugValue", () => {
    it("is a no-op", () => {
      expect(() => ServerDispatcher.useDebugValue("debug", String)).not.toThrow();
    });
  });

  describe("useTransition", () => {
    it("returns [false, callback]", () => {
      const [isPending, startTransition] = ServerDispatcher.useTransition();
      expect(isPending).toBe(false);

      let called = false;
      startTransition(() => {
        called = true;
      });
      expect(called).toBe(true);
    });
  });

  describe("useDeferredValue", () => {
    it("returns the value as-is", () => {
      expect(ServerDispatcher.useDeferredValue("value")).toBe("value");
    });
  });

  describe("useId", () => {
    it("returns a string ID", () => {
      const id = ServerDispatcher.useId();
      expect(typeof id).toBe("string");
      expect(id.startsWith(":r")).toBe(true);
      expect(id.endsWith(":")).toBe(true);
    });

    it("increments IDs", () => {
      const id1 = ServerDispatcher.useId();
      const id2 = ServerDispatcher.useId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("useSyncExternalStore", () => {
    it("calls getServerSnapshot when provided", () => {
      const result = ServerDispatcher.useSyncExternalStore(
        () => () => {},
        () => "client",
        () => "server",
      );
      expect(result).toBe("server");
    });

    it("throws when no getServerSnapshot", () => {
      expect(() =>
        ServerDispatcher.useSyncExternalStore(
          () => () => {},
          () => "client",
        ),
      ).toThrow("useSyncExternalStore requires getServerSnapshot");
    });
  });

  describe("use", () => {
    it("returns context value for context objects", () => {
      const ctx = createContext("contextValue");
      const result = ServerDispatcher.use(ctx as never);
      expect(result).toBe("contextValue");
    });

    it("throws for promise objects", () => {
      const promise = Promise.resolve("value");
      expect(() => ServerDispatcher.use(promise as never)).toThrow("use() with promises");
    });

    it("throws for non-context objects", () => {
      expect(() => ServerDispatcher.use({ then: () => {} } as never)).toThrow();
    });
  });

  describe("useOptimistic", () => {
    it("returns passthrough value and no-op", () => {
      const [value, setOptimistic] = ServerDispatcher.useOptimistic("initial");
      expect(value).toBe("initial");
      expect(() => setOptimistic("action" as never)).not.toThrow();
    });
  });

  describe("useActionState", () => {
    it("returns initial state, no-op dispatch, and false", () => {
      const action = async (_: string, __: string) => "";
      const [state, dispatch, isPending] = ServerDispatcher.useActionState(action, "initial");
      expect(state).toBe("initial");
      expect(typeof dispatch).toBe("function");
      expect(isPending).toBe(false);
    });
  });
});
