import type { Fiber, FiberRoot } from "./ReactFiberTypes.js";
import type { HostConfig } from "../host-config/HostConfigInterface.js";
import { HostRoot } from "./ReactWorkTags.js";

// Simple stack-based host context tracking

interface StackCursor<T> {
  current: T;
}

function createCursor<T>(defaultValue: T): StackCursor<T> {
  return { current: defaultValue };
}

const contextStack: Array<unknown> = [];
let contextIndex = -1;

function push<T>(cursor: StackCursor<T>, value: T): void {
  contextIndex++;
  contextStack[contextIndex] = cursor.current;
  cursor.current = value;
}

function pop<T>(cursor: StackCursor<T>): void {
  if (contextIndex < 0) {
    return;
  }
  cursor.current = contextStack[contextIndex] as T;
  contextStack[contextIndex] = null;
  contextIndex--;
}

const rootInstanceCursor: StackCursor<unknown> = createCursor(null);
const hostContextCursor: StackCursor<unknown> = createCursor(null);
const hostConfigCursor: StackCursor<HostConfig | null> = createCursor(null);

function getHostConfigFromFiber(fiber: Fiber): HostConfig {
  let node: Fiber | null = fiber;
  while (node !== null) {
    if (node.tag === HostRoot && node.stateNode) {
      return (node.stateNode as FiberRoot).hostConfig;
    }
    node = node.return;
  }
  // Fallback to stored config
  if (hostConfigCursor.current) {
    return hostConfigCursor.current;
  }
  throw new Error("Could not find host config");
}

export function getRootHostContainer(): unknown {
  return rootInstanceCursor.current;
}

export function getHostContext(): unknown {
  return hostContextCursor.current;
}

export function pushHostContainer(fiber: Fiber): void {
  const fiberRoot = fiber.stateNode as FiberRoot;
  const container = fiberRoot.containerInfo;
  const hostConfig = fiberRoot.hostConfig;

  push(rootInstanceCursor, container);
  push(hostConfigCursor, hostConfig);
  push(hostContextCursor, hostConfig.getRootHostContext(container));
}

export function popHostContainer(_fiber: Fiber): void {
  pop(hostContextCursor);
  pop(hostConfigCursor);
  pop(rootInstanceCursor);
}

export function pushHostContext(fiber: Fiber): void {
  const hostConfig = getHostConfigFromFiber(fiber);
  const context = hostContextCursor.current;

  // For HostComponent, fiber.type is expected to be a string (tag name).
  // For other components, we use an empty string or the component name if available.
  const type =
    typeof fiber.type === "string"
      ? fiber.type
      : typeof fiber.type === "function"
        ? (fiber.type as any).name
        : "";

  const nextContext = hostConfig.getChildHostContext(context, type);

  // Always push so that popHostContext can always pop symmetrically.
  push(hostContextCursor, nextContext);
}

export function popHostContext(_fiber: Fiber): void {
  pop(hostContextCursor);
}
