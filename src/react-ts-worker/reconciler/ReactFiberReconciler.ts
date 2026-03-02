// ReactFiberReconciler - Public API for creating and updating containers

import type { FiberRoot } from "./ReactFiberTypes.js";
import type { HostConfig } from "../host-config/HostConfigInterface.js";
import type { ReactNode } from "../react/ReactTypes.js";
import { createFiberRoot } from "./ReactFiberRoot.js";
import { SyncLane } from "./ReactFiberLane.js";
import { scheduleUpdateOnFiber } from "./ReactFiberWorkLoop.js";

export function createContainer(containerInfo: unknown, hostConfig: HostConfig): FiberRoot {
  return createFiberRoot(containerInfo, hostConfig);
}

export function updateContainer(element: ReactNode | null, container: FiberRoot): void {
  const current = container.current;
  const lane = SyncLane;

  // Enqueue the update
  const update = {
    element,
  };

  current.memoizedState = update;
  current.lanes = lane;

  scheduleUpdateOnFiber(container, current, lane);
}

export function getPublicRootInstance(container: FiberRoot): unknown {
  const containerFiber = container.current;
  if (!containerFiber.child) {
    return null;
  }
  return containerFiber.child.stateNode;
}
