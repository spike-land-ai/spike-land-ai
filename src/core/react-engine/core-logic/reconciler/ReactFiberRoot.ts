import type { ClassUpdateQueue, Fiber, FiberRoot } from "./ReactFiberTypes.js";
import type { HostConfig } from "../host-config/HostConfigInterface.js";
import { createHostRootFiber } from "./ReactFiber.js";
import { createLaneMap, NoLane, NoLanes } from "./ReactFiberLane.js";

export function createFiberRoot(containerInfo: unknown, hostConfig: HostConfig): FiberRoot {
  const root: FiberRoot = {
    containerInfo,
    current: null as unknown as Fiber, // Will be set below
    finishedWork: null,

    callbackNode: null,
    callbackPriority: NoLane,

    pendingLanes: NoLanes,
    suspendedLanes: NoLanes,
    pingedLanes: NoLanes,
    expiredLanes: NoLanes,
    entangledLanes: NoLanes,
    entanglements: createLaneMap(NoLanes),

    hostConfig,

    pendingPassiveEffects: {
      unmount: [],
      mount: [],
      update: [],
    },

    identifierPrefix: "",
    identifierCount: 0,
  };

  // Create the host root fiber
  const uninitializedFiber: Fiber = createHostRootFiber();
  root.current = uninitializedFiber;
  uninitializedFiber.stateNode = root;

  // Initialize the update queue for the root fiber
  const queue: ClassUpdateQueue = {
    baseState: uninitializedFiber.memoizedState,
    firstBaseUpdate: null as any,
    lastBaseUpdate: null as any,
    shared: {
      pending: null as any,
    },
    callbacks: null as any,
  };
  uninitializedFiber.updateQueue = queue;

  return root;
}
