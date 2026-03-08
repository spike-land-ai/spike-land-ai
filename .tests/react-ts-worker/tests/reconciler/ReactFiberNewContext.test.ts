import { describe, expect, it } from "vitest";
import {
  prepareToReadContext,
  propagateContextChange,
  pushProvider,
  popProvider,
  readContext,
  resetContextDependencies,
} from "../../../../src/core/react-engine/reconciler/ReactFiberNewContext.js";
import { createContext } from "../../../../src/core/react-engine/react/ReactContext.js";
import type { Fiber } from "../../../../src/core/react-engine/reconciler/ReactFiberTypes.js";
import { NoLanes, SyncLane } from "../../../../src/core/react-engine/reconciler/ReactFiberLane.js";
import { NoFlags } from "../../../../src/core/react-engine/reconciler/ReactFiberFlags.js";
import {
  FunctionComponent,
  HostComponent,
} from "../../../../src/core/react-engine/reconciler/ReactWorkTags.js";

function makeTestFiber(overrides: Partial<Fiber> = {}): Fiber {
  return {
    tag: FunctionComponent,
    key: null,
    elementType: null,
    type: null,
    stateNode: null,
    return: null,
    child: null,
    sibling: null,
    index: 0,
    ref: null,
    refCleanup: null,
    pendingProps: {},
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
    ...overrides,
  };
}

describe("ReactFiberNewContext", () => {
  describe("resetContextDependencies", () => {
    it("does not throw", () => {
      expect(() => resetContextDependencies()).not.toThrow();
    });
  });

  describe("pushProvider and popProvider", () => {
    it("pushes and restores context value", () => {
      const ctx = createContext("default");
      const fiber = makeTestFiber();

      expect(ctx._currentValue).toBe("default");

      pushProvider(fiber, ctx, "newValue");
      expect(ctx._currentValue).toBe("newValue");

      popProvider(ctx, fiber);
      expect(ctx._currentValue).toBe("default");
    });

    it("handles nested providers", () => {
      const ctx = createContext("outer");
      const fiber1 = makeTestFiber();
      const fiber2 = makeTestFiber();

      pushProvider(fiber1, ctx, "inner1");
      pushProvider(fiber2, ctx, "inner2");
      expect(ctx._currentValue).toBe("inner2");

      popProvider(ctx, fiber2);
      expect(ctx._currentValue).toBe("inner1");

      popProvider(ctx, fiber1);
      expect(ctx._currentValue).toBe("outer");
    });
  });

  describe("prepareToReadContext and readContext", () => {
    it("allows reading context without a consumer fiber", () => {
      const ctx = createContext(42);
      resetContextDependencies();

      // readContext with no consumer
      const value = readContext(ctx);
      expect(value).toBe(42);
    });

    it("records context dependency when consumer is set", () => {
      const ctx = createContext("hello");
      const fiber = makeTestFiber();

      prepareToReadContext(fiber, SyncLane);
      const value = readContext(ctx);

      expect(value).toBe("hello");
      expect(fiber.dependencies).not.toBeNull();
      expect(fiber.dependencies?.firstContext).not.toBeNull();
    });

    it("clears previous dependencies on prepare", () => {
      const _ctx = createContext("value");
      const fiber = makeTestFiber({
        dependencies: { lanes: SyncLane, firstContext: {} as never },
      });

      prepareToReadContext(fiber, SyncLane);
      expect(fiber.dependencies?.firstContext).toBeNull();
    });

    it("appends multiple context dependencies", () => {
      const ctx1 = createContext("first");
      const ctx2 = createContext("second");
      const fiber = makeTestFiber();

      prepareToReadContext(fiber, SyncLane);
      readContext(ctx1);
      readContext(ctx2);

      expect(fiber.dependencies?.firstContext).not.toBeNull();
      expect(fiber.dependencies?.firstContext?.next).not.toBeNull();
    });

    it("reads updated context value after provider push", () => {
      const ctx = createContext("original");
      const providerFiber = makeTestFiber();
      const consumerFiber = makeTestFiber();

      pushProvider(providerFiber, ctx, "updated");
      prepareToReadContext(consumerFiber, SyncLane);
      const value = readContext(ctx);

      expect(value).toBe("updated");
      popProvider(ctx, providerFiber);
    });

    it("creates dependencies when fiber.dependencies is null", () => {
      const ctx = createContext("test");
      const fiber = makeTestFiber({ dependencies: null });

      prepareToReadContext(fiber, SyncLane);
      readContext(ctx);

      expect(fiber.dependencies).not.toBeNull();
    });
  });

  describe("propagateContextChange", () => {
    it("does not throw when workInProgress has no children", () => {
      const ctx = createContext("value");
      const fiber = makeTestFiber();

      expect(() => propagateContextChange(fiber, ctx, SyncLane)).not.toThrow();
    });

    it("schedules update on fiber that consumes the changed context", () => {
      const ctx = createContext("initial");
      const parent = makeTestFiber({ tag: HostComponent });
      const child = makeTestFiber({
        tag: FunctionComponent,
        dependencies: {
          lanes: NoLanes,
          firstContext: {
            context: ctx,
            memoizedValue: "initial",
            next: null,
          },
        },
        childLanes: NoLanes,
        lanes: NoLanes,
      });

      parent.child = child;
      child.return = parent;

      propagateContextChange(parent, ctx, SyncLane);

      expect((child.lanes & SyncLane) !== 0).toBe(true);
    });

    it("handles fiber tree traversal with siblings", () => {
      const ctx = createContext("value");
      const parent = makeTestFiber({ tag: HostComponent });
      const child1 = makeTestFiber({ tag: FunctionComponent });
      const child2 = makeTestFiber({ tag: FunctionComponent });

      parent.child = child1;
      child1.return = parent;
      child1.sibling = child2;
      child2.return = parent;

      expect(() => propagateContextChange(parent, ctx, SyncLane)).not.toThrow();
    });

    it("propagates lane changes up the parent path", () => {
      const ctx = createContext("initial");
      const grandparent = makeTestFiber({ tag: HostComponent, childLanes: NoLanes });
      const parent = makeTestFiber({ tag: HostComponent, childLanes: NoLanes });
      const child = makeTestFiber({
        tag: FunctionComponent,
        dependencies: {
          lanes: NoLanes,
          firstContext: {
            context: ctx,
            memoizedValue: "initial",
            next: null,
          },
        },
        lanes: NoLanes,
        childLanes: NoLanes,
      });

      grandparent.child = parent;
      parent.return = grandparent;
      parent.child = child;
      child.return = parent;

      propagateContextChange(grandparent, ctx, SyncLane);

      expect((child.lanes & SyncLane) !== 0).toBe(true);
    });

    it("skips fibers without matching context dependency", () => {
      const ctx1 = createContext("ctx1");
      const ctx2 = createContext("ctx2");
      const parent = makeTestFiber({ tag: HostComponent });
      const child = makeTestFiber({
        tag: FunctionComponent,
        dependencies: {
          lanes: NoLanes,
          firstContext: {
            context: ctx2,
            memoizedValue: "ctx2",
            next: null,
          },
        },
        lanes: NoLanes,
      });

      parent.child = child;
      child.return = parent;

      propagateContextChange(parent, ctx1, SyncLane);

      expect(child.lanes & SyncLane).toBe(0);
    });
  });
});
