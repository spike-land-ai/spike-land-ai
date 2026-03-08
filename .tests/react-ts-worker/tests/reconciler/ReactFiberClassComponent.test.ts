import { describe, expect, it } from "vitest";
import {
  constructClassInstance,
  createClassUpdate,
  enqueueClassUpdate,
  initializeClassUpdateQueue,
  mountClassInstance,
  processClassUpdateQueue,
  updateClassInstance,
} from "../../../../src/core/react-engine/reconciler/ReactFiberClassComponent.js";
import type { Fiber } from "../../../../src/core/react-engine/reconciler/ReactFiberTypes.js";
import { SyncLane } from "../../../../src/core/react-engine/reconciler/ReactFiberLane.js";
import { ClassComponent } from "../../../../src/core/react-engine/reconciler/ReactWorkTags.js";

function makeFiber(overrides: Partial<Fiber> = {}): Fiber {
  return {
    tag: ClassComponent,
    key: null,
    type: null,
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    index: 0,
    ref: null,
    pendingProps: {},
    memoizedProps: {},
    memoizedState: null,
    updateQueue: null,
    flags: 0,
    subtreeFlags: 0,
    deletions: null,
    lanes: 0,
    childLanes: 0,
    alternate: null,
    mode: 0,
    ...overrides,
  } as unknown as Fiber;
}

class SimpleComponent {
  props: Record<string, unknown>;
  state: Record<string, unknown> | null;
  context: unknown;
  refs: Record<string, unknown>;

  constructor(props: Record<string, unknown>) {
    this.props = props;
    this.state = { value: "initial" };
    this.context = {};
    this.refs = {};
  }

  render() {
    return null;
  }
}
(SimpleComponent.prototype as unknown as Record<string, unknown>).isReactComponent = {};

describe("initializeClassUpdateQueue", () => {
  it("creates update queue on fiber", () => {
    const fiber = makeFiber({ memoizedState: { count: 0 } });
    initializeClassUpdateQueue(fiber);
    expect(fiber.updateQueue).toBeDefined();
    const q = fiber.updateQueue as { baseState: unknown; shared: { pending: unknown } };
    expect(q.baseState).toEqual({ count: 0 });
    expect(q.shared.pending).toBeNull();
  });
});

describe("createClassUpdate", () => {
  it("creates update with lane", () => {
    const update = createClassUpdate(SyncLane);
    expect(update.lane).toBe(SyncLane);
    expect(update.tag).toBe(0);
    expect(update.payload).toBeNull();
    expect(update.callback).toBeNull();
    expect(update.next).toBeNull();
  });
});

describe("enqueueClassUpdate", () => {
  it("enqueues to empty queue (circular list)", () => {
    const fiber = makeFiber();
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.payload = { x: 1 };
    enqueueClassUpdate(fiber, update);
    const q = fiber.updateQueue as { shared: { pending: unknown } };
    expect(q.shared.pending).toBe(update);
  });

  it("enqueues multiple updates", () => {
    const fiber = makeFiber();
    initializeClassUpdateQueue(fiber);
    const u1 = createClassUpdate(SyncLane);
    u1.payload = { a: 1 };
    const u2 = createClassUpdate(SyncLane);
    u2.payload = { b: 2 };
    enqueueClassUpdate(fiber, u1);
    enqueueClassUpdate(fiber, u2);
    const q = fiber.updateQueue as { shared: { pending: unknown } };
    expect(q.shared.pending).toBe(u2);
  });

  it("does nothing when updateQueue is null", () => {
    const fiber = makeFiber({ updateQueue: null });
    const update = createClassUpdate(SyncLane);
    expect(() => enqueueClassUpdate(fiber, update)).not.toThrow();
  });
});

describe("processClassUpdateQueue", () => {
  it("applies object payload to state", () => {
    const fiber = makeFiber({ memoizedState: { count: 0 } });
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.payload = { count: 5 };
    enqueueClassUpdate(fiber, update);
    const instance = new SimpleComponent({});
    instance.state = { count: 0 };
    processClassUpdateQueue(fiber, {}, instance, SyncLane);
    expect(fiber.memoizedState).toEqual({ count: 5 });
  });

  it("applies functional payload to state", () => {
    const fiber = makeFiber({ memoizedState: { count: 3 } });
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.payload = (s: { count: number }) => ({ count: s.count + 10 });
    enqueueClassUpdate(fiber, update);
    processClassUpdateQueue(fiber, {}, {}, SyncLane);
    expect((fiber.memoizedState as { count: number }).count).toBe(13);
  });

  it("handles ReplaceState (tag=1)", () => {
    const fiber = makeFiber({ memoizedState: { old: true } });
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.tag = 1; // ReplaceState
    update.payload = { new: true };
    enqueueClassUpdate(fiber, update);
    processClassUpdateQueue(fiber, {}, {}, SyncLane);
    expect(fiber.memoizedState).toEqual({ new: true });
  });

  it("handles ForceUpdate (tag=2)", () => {
    const fiber = makeFiber({ memoizedState: { x: 1 } });
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.tag = 2; // ForceUpdate
    enqueueClassUpdate(fiber, update);
    processClassUpdateQueue(fiber, {}, {}, SyncLane);
    expect(fiber.memoizedState).toEqual({ x: 1 }); // unchanged
  });

  it("collects callbacks", () => {
    const fiber = makeFiber({ memoizedState: {} });
    initializeClassUpdateQueue(fiber);
    const update = createClassUpdate(SyncLane);
    update.payload = { a: 1 };
    const cb = () => {};
    update.callback = cb;
    enqueueClassUpdate(fiber, update);
    processClassUpdateQueue(fiber, {}, {}, SyncLane);
    const q = fiber.updateQueue as { callbacks: unknown[] | null };
    expect(q.callbacks).toContain(cb);
  });

  it("does nothing when queue is null", () => {
    const fiber = makeFiber({ updateQueue: null });
    expect(() => processClassUpdateQueue(fiber, {}, {}, SyncLane)).not.toThrow();
  });
});

describe("constructClassInstance", () => {
  it("creates instance and sets fiber.stateNode", () => {
    const fiber = makeFiber();
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      { x: 1 },
    );
    expect(instance).toBeDefined();
    expect(fiber.stateNode).toBe(instance);
    expect(instance.props).toEqual({ x: 1 });
  });

  it("uses null state when component has no state", () => {
    class NoState {
      props: Record<string, unknown>;
      constructor(props: Record<string, unknown>) {
        this.props = props;
      }
      render() {
        return null;
      }
    }
    (NoState.prototype as unknown as Record<string, unknown>).isReactComponent = {};
    const fiber = makeFiber();
    const _instance = constructClassInstance(
      fiber,
      NoState as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    expect(fiber.memoizedState).toBeNull();
  });

  it("sets up updater with enqueueSetState", () => {
    const fiber = makeFiber({ memoizedState: {} });
    initializeClassUpdateQueue(fiber);
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    const updater = (instance as unknown as Record<string, { enqueueSetState: (...args: unknown[]) => unknown }>).updater;
    expect(typeof updater.enqueueSetState).toBe("function");
    // Should not throw
    expect(() => updater.enqueueSetState(instance, { newState: true }, null)).not.toThrow();
  });

  it("sets up updater with enqueueReplaceState", () => {
    const fiber = makeFiber({ memoizedState: {} });
    initializeClassUpdateQueue(fiber);
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    const updater = (instance as unknown as Record<string, { enqueueReplaceState: (...args: unknown[]) => unknown }>)
      .updater;
    expect(() => updater.enqueueReplaceState(instance, {}, null)).not.toThrow();
  });

  it("sets up updater with enqueueForceUpdate", () => {
    const fiber = makeFiber({ memoizedState: {} });
    initializeClassUpdateQueue(fiber);
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    const updater = (instance as unknown as Record<string, { enqueueForceUpdate: (...args: unknown[]) => unknown }>)
      .updater;
    expect(() => updater.enqueueForceUpdate(instance, null)).not.toThrow();
  });

  it("updater isMounted returns true", () => {
    const fiber = makeFiber({ memoizedState: {} });
    initializeClassUpdateQueue(fiber);
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    const updater = (instance as unknown as Record<string, { isMounted: (...args: unknown[]) => unknown }>).updater;
    expect(updater.isMounted()).toBe(true);
  });
});

describe("mountClassInstance", () => {
  it("initializes instance state and processes updates", () => {
    const fiber = makeFiber({ memoizedState: { value: "initial" } });
    initializeClassUpdateQueue(fiber);
    const instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      { prop: 1 },
    );
    mountClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof mountClassInstance>[1],
      { prop: 1 },
      SyncLane,
    );
    expect(instance.props).toEqual({ prop: 1 });
  });

  it("calls getDerivedStateFromProps if defined", () => {
    class WithDerived {
      props: Record<string, unknown>;
      state = { derived: false };
      constructor(props: Record<string, unknown>) {
        this.props = props;
      }
      render() {
        return null;
      }
      static getDerivedStateFromProps(props: { active: boolean }) {
        return { derived: props.active };
      }
    }
    (WithDerived.prototype as unknown as Record<string, unknown>).isReactComponent = {};
    const fiber = makeFiber({ memoizedState: { derived: false } });
    initializeClassUpdateQueue(fiber);
    constructClassInstance(
      fiber,
      WithDerived as unknown as Parameters<typeof constructClassInstance>[1],
      { active: true },
    );
    mountClassInstance(
      fiber,
      WithDerived as unknown as Parameters<typeof mountClassInstance>[1],
      { active: true },
      SyncLane,
    );
    expect((fiber.memoizedState as { derived: boolean }).derived).toBe(true);
  });

  it("marks Update flag if componentDidMount exists", () => {
    class WithDidMount {
      props: Record<string, unknown>;
      state = null;
      constructor(props: Record<string, unknown>) {
        this.props = props;
      }
      render() {
        return null;
      }
      componentDidMount() {}
    }
    (WithDidMount.prototype as unknown as Record<string, unknown>).isReactComponent = {};
    const fiber = makeFiber();
    initializeClassUpdateQueue(fiber);
    constructClassInstance(
      fiber,
      WithDidMount as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    mountClassInstance(
      fiber,
      WithDidMount as unknown as Parameters<typeof mountClassInstance>[1],
      {},
      SyncLane,
    );
    expect(fiber.flags & 4).toBeTruthy(); // Update flag
  });
});

describe("updateClassInstance", () => {
  it("returns true (shouldUpdate=true) by default", () => {
    const fiber = makeFiber({ memoizedState: { x: 1 }, memoizedProps: { a: 1 } });
    initializeClassUpdateQueue(fiber);
    const _instance = constructClassInstance(
      fiber,
      SimpleComponent as unknown as Parameters<typeof constructClassInstance>[1],
      { a: 1 },
    );
    const current = { ...fiber } as Fiber;
    const result = updateClassInstance(
      current,
      fiber,
      SimpleComponent as unknown as Parameters<typeof updateClassInstance>[2],
      { a: 2 },
      SyncLane,
    );
    expect(result).toBe(true);
  });

  it("returns false when shouldComponentUpdate returns false", () => {
    class WithSCU {
      props: Record<string, unknown>;
      state = {};
      constructor(props: Record<string, unknown>) {
        this.props = props;
      }
      render() {
        return null;
      }
      shouldComponentUpdate() {
        return false;
      }
    }
    (WithSCU.prototype as unknown as Record<string, unknown>).isReactComponent = {};
    const fiber = makeFiber({ memoizedState: {}, memoizedProps: {} });
    initializeClassUpdateQueue(fiber);
    constructClassInstance(
      fiber,
      WithSCU as unknown as Parameters<typeof constructClassInstance>[1],
      {},
    );
    const current = { ...fiber, alternate: null } as unknown as Fiber;
    const result = updateClassInstance(
      current,
      fiber,
      WithSCU as unknown as Parameters<typeof updateClassInstance>[2],
      {},
      SyncLane,
    );
    expect(result).toBe(false);
  });
});
