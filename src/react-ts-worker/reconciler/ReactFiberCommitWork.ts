// CommitWork - Commit phase: apply fiber effects to the host tree
// Three sub-phases: before mutation, mutation, layout

import type { Effect, Fiber, FiberRoot, FunctionComponentUpdateQueue } from "./ReactFiberTypes.js";
import type { HostConfig } from "../host-config/HostConfigInterface.js";
import {
  ClassComponent,
  ForwardRef,
  FunctionComponent,
  HostComponent,
  HostRoot,
  HostText,
  MemoComponent,
  SimpleMemoComponent,
} from "./ReactWorkTags.js";
import {
  BeforeMutationMask,
  ChildDeletion,
  ContentReset,
  LayoutMask,
  MutationMask,
  NoFlags,
  Passive,
  PassiveMask,
  Placement,
  Ref,
  Snapshot,
  Update,
} from "./ReactFiberFlags.js";
import type { ComponentInstance } from "../react/ReactTypes.js";
import { HookHasEffect, HookInsertion, HookLayout, HookPassive } from "./ReactFiberHooks.js";

function getHostParent(fiber: Fiber): { parent: unknown; isContainer: boolean } {
  let node: Fiber | null = fiber.return;
  while (node !== null) {
    if (node.tag === HostComponent) {
      return { parent: node.stateNode, isContainer: false };
    }
    if (node.tag === HostRoot) {
      return {
        parent: (node.stateNode as FiberRoot).containerInfo,
        isContainer: true,
      };
    }
    node = node.return;
  }
  throw new Error("Could not find host parent");
}

function getHostSibling(fiber: Fiber): unknown {
  let node: Fiber = fiber;

  siblings: while (true) {
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;

    while (node.tag !== HostComponent && node.tag !== HostText) {
      if (node.flags & Placement) {
        continue siblings;
      }
      if (node.child === null) {
        continue siblings;
      }
      node.child.return = node;
      node = node.child;
    }

    if (!(node.flags & Placement)) {
      return node.stateNode;
    }
  }
}

function isHostParent(fiber: Fiber): boolean {
  return fiber.tag === HostComponent || fiber.tag === HostRoot;
}

// ─── Before Mutation Phase ───────────────────────────────────────────────

export function commitBeforeMutationEffects(_root: FiberRoot, finishedWork: Fiber): void {
  commitBeforeMutationEffectsOnFiber(finishedWork);
}

function commitBeforeMutationEffectsOnFiber(fiber: Fiber): void {
  // Process children first
  let child = fiber.child;
  if ((fiber.subtreeFlags & BeforeMutationMask) !== NoFlags && child !== null) {
    while (child !== null) {
      commitBeforeMutationEffectsOnFiber(child);
      child = child.sibling;
    }
  }

  if ((fiber.flags & Snapshot) !== NoFlags) {
    if (fiber.tag === ClassComponent) {
      const instance = fiber.stateNode as ComponentInstance;
      const current = fiber.alternate;
      if (current !== null && typeof instance.getSnapshotBeforeUpdate === "function") {
        instance.getSnapshotBeforeUpdate(
          current.memoizedProps as Readonly<Record<string, unknown>>,
          current.memoizedState as Readonly<Record<string, unknown>>,
        );
      }
    }
  }
}

// ─── Mutation Phase ─────────────────────────────────────────────────────

export function commitMutationEffects(root: FiberRoot, finishedWork: Fiber): void {
  commitMutationEffectsOnFiber(finishedWork, root);
}

function commitMutationEffectsOnFiber(fiber: Fiber, root: FiberRoot): void {
  const hostConfig = root.hostConfig;

  // Process children first
  let child = fiber.child;
  if ((fiber.subtreeFlags & MutationMask) !== NoFlags && child !== null) {
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }

  const flags = fiber.flags;

  // Handle deletions
  if (flags & ChildDeletion) {
    const deletions = fiber.deletions;
    if (deletions !== null) {
      for (let i = 0; i < deletions.length; i++) {
        commitDeletion(root, deletions[i]!, fiber, hostConfig);
      }
    }
  }

  // Handle placement (insertion)
  if (flags & Placement) {
    commitPlacement(fiber, hostConfig);
    fiber.flags &= ~Placement;
  }

  // Handle updates
  if (flags & Update) {
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case MemoComponent:
      case SimpleMemoComponent: {
        // Commit insertion effects
        commitHookEffectListUnmount(HookInsertion | HookHasEffect, fiber);
        commitHookEffectListMount(HookInsertion | HookHasEffect, fiber);
        break;
      }
      case HostComponent: {
        const instance = fiber.stateNode;
        if (instance !== null) {
          const newProps = fiber.memoizedProps;
          const oldProps = fiber.alternate !== null ? fiber.alternate.memoizedProps : newProps;
          hostConfig.commitUpdate(
            instance,
            fiber.type as string,
            oldProps as Record<string, unknown>,
            newProps as Record<string, unknown>,
          );
        }
        break;
      }
      case HostText: {
        const textInstance = fiber.stateNode;
        const newText = fiber.memoizedProps;
        const oldText = fiber.alternate !== null ? fiber.alternate.memoizedProps : newText;
        if (textInstance !== null) {
          hostConfig.commitTextUpdate(textInstance, oldText as string, newText as string);
        }
        break;
      }
    }
  }

  // Handle content reset
  if (flags & ContentReset) {
    if (fiber.tag === HostComponent) {
      hostConfig.resetTextContent(fiber.stateNode);
    }
  }

  // Handle ref
  if (flags & Ref) {
    const current = fiber.alternate;
    if (current !== null) {
      commitDetachRef(current);
    }
  }
}

function commitPlacement(finishedWork: Fiber, hostConfig: HostConfig): void {
  const { parent, isContainer } = getHostParent(finishedWork);
  const before = getHostSibling(finishedWork);

  if (finishedWork.tag === HostComponent || finishedWork.tag === HostText) {
    const stateNode = finishedWork.stateNode;
    if (before !== null) {
      if (isContainer) {
        hostConfig.insertInContainerBefore(parent, stateNode, before);
      } else {
        hostConfig.insertBefore(parent, stateNode, before);
      }
    } else {
      if (isContainer) {
        hostConfig.appendChildToContainer(parent, stateNode);
      } else {
        hostConfig.appendChild(parent, stateNode);
      }
    }
  } else {
    // Composite component - traverse to find host children
    let child = finishedWork.child;
    while (child !== null) {
      commitPlacement(child, hostConfig);
      child = child.sibling;
    }
  }
}

function commitDeletion(
  root: FiberRoot,
  childToDelete: Fiber,
  hostParentFiber: Fiber,
  hostConfig: HostConfig,
): void {
  // Find host parent
  const { parent, isContainer } = getHostParent(hostParentFiber);

  // Unmount the subtree
  commitNestedUnmounts(childToDelete, root);

  // Remove from host tree
  removeHostChildren(childToDelete, parent, isContainer, hostConfig);
}

function removeHostChildren(
  fiber: Fiber,
  parent: unknown,
  isContainer: boolean,
  hostConfig: HostConfig,
): void {
  if (fiber.tag === HostComponent || fiber.tag === HostText) {
    if (isContainer) {
      hostConfig.removeChildFromContainer(parent, fiber.stateNode);
    } else {
      hostConfig.removeChild(parent, fiber.stateNode);
    }
  } else {
    let child = fiber.child;
    while (child !== null) {
      removeHostChildren(child, parent, isContainer, hostConfig);
      child = child.sibling;
    }
  }
}

function commitNestedUnmounts(fiber: Fiber, root: FiberRoot): void {
  let node: Fiber = fiber;
  while (true) {
    commitUnmount(node, root);
    if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === fiber) return;
    while (node.sibling === null) {
      if (node.return === null || node.return === fiber) return;
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitUnmount(fiber: Fiber, _root: FiberRoot): void {
  switch (fiber.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent: {
      // Unmount layout effects synchronously
      commitHookEffectListUnmount(HookLayout | HookHasEffect, fiber);
      // Schedule passive effect cleanup
      break;
    }
    case ClassComponent: {
      const instance = fiber.stateNode as ComponentInstance | null;
      if (instance !== null && typeof instance.componentWillUnmount === "function") {
        instance.componentWillUnmount();
      }
      break;
    }
  }

  // Detach ref
  commitDetachRef(fiber);
}

function commitDetachRef(fiber: Fiber): void {
  const ref = fiber.ref;
  if (ref !== null) {
    if (typeof ref === "function") {
      ref(null);
    } else if (typeof ref === "object") {
      (ref as { current: unknown }).current = null;
    }
  }
}

// ─── Layout Phase ───────────────────────────────────────────────────────

export function commitLayoutEffects(root: FiberRoot, finishedWork: Fiber): void {
  commitLayoutEffectsOnFiber(finishedWork, root);
}

function commitLayoutEffectsOnFiber(fiber: Fiber, root: FiberRoot): void {
  // Process children first
  let child = fiber.child;
  if ((fiber.subtreeFlags & LayoutMask) !== NoFlags && child !== null) {
    while (child !== null) {
      commitLayoutEffectsOnFiber(child, root);
      child = child.sibling;
    }
  }

  const flags = fiber.flags;

  if (flags & (Update | Ref)) {
    const current = fiber.alternate;

    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        if (flags & Update) {
          commitHookEffectListMount(HookLayout | HookHasEffect, fiber);
        }
        break;
      }
      case ClassComponent: {
        if (flags & Update) {
          const instance = fiber.stateNode as ComponentInstance;
          if (current === null) {
            if (typeof instance.componentDidMount === "function") {
              instance.componentDidMount();
            }
          } else {
            if (typeof instance.componentDidUpdate === "function") {
              instance.componentDidUpdate(
                current.memoizedProps as Readonly<Record<string, unknown>>,
                current.memoizedState as Readonly<Record<string, unknown>>,
                (instance as unknown as Record<string, unknown>).__snapshot,
              );
            }
          }
        }
        break;
      }
      case HostComponent: {
        // Auto-focus if needed
        if (current === null && flags & Update) {
          const instance = fiber.stateNode as Element;
          if (
            (fiber.memoizedProps as Record<string, unknown> | null)?.autoFocus &&
            typeof (instance as unknown as Record<string, unknown>).focus === "function"
          ) {
            (
              instance as unknown as Record<string, unknown> & {
                focus: () => void;
              }
            ).focus();
          }
        }
        break;
      }
    }

    // Attach ref
    if (flags & Ref) {
      commitAttachRef(fiber);
    }
  }
}

function commitAttachRef(fiber: Fiber): void {
  const ref = fiber.ref;
  if (ref === null) return;

  const instance = fiber.stateNode;
  if (typeof ref === "function") {
    const cleanup = ref(instance);
    if (typeof cleanup === "function") {
      fiber.refCleanup = cleanup;
    }
  } else if (typeof ref === "object") {
    (ref as { current: unknown }).current = instance;
  }
}

// ─── Passive Effects ─────────────────────────────────────────────────────

export function commitPassiveUnmountEffects(fiber: Fiber): void {
  commitPassiveUnmountOnFiber(fiber);
}

function commitPassiveUnmountOnFiber(fiber: Fiber): void {
  let child = fiber.child;
  if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
    while (child !== null) {
      commitPassiveUnmountOnFiber(child);
      child = child.sibling;
    }
  }

  if ((fiber.flags & Passive) !== NoFlags) {
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        commitHookEffectListUnmount(HookPassive | HookHasEffect, fiber);
        break;
      }
    }
  }
}

export function commitPassiveMountEffects(root: FiberRoot, fiber: Fiber): void {
  commitPassiveMountOnFiber(root, fiber);
}

function commitPassiveMountOnFiber(root: FiberRoot, fiber: Fiber): void {
  let child = fiber.child;
  if ((fiber.subtreeFlags & PassiveMask) !== NoFlags && child !== null) {
    while (child !== null) {
      commitPassiveMountOnFiber(root, child);
      child = child.sibling;
    }
  }

  if ((fiber.flags & Passive) !== NoFlags) {
    switch (fiber.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent: {
        commitHookEffectListMount(HookPassive | HookHasEffect, fiber);
        break;
      }
    }
  }
}

// ─── Hook Effect Helpers ─────────────────────────────────────────────────

function commitHookEffectListMount(flags: number, fiber: Fiber): void {
  const updateQueue = fiber.updateQueue as FunctionComponentUpdateQueue | null;
  if (updateQueue === null) return;

  const lastEffect = updateQueue.lastEffect;
  if (lastEffect === null) return;

  const firstEffect = lastEffect.next;
  let effect: Effect | null = firstEffect;
  do {
    if (effect === null) break;
    if ((effect.tag & flags) === flags) {
      const create = effect.create;
      const destroy = create();
      effect.destroy = destroy;
    }
    effect = effect.next;
  } while (effect !== firstEffect);
}

function commitHookEffectListUnmount(flags: number, fiber: Fiber): void {
  const updateQueue = fiber.updateQueue as FunctionComponentUpdateQueue | null;
  if (updateQueue === null) return;

  const lastEffect = updateQueue.lastEffect;
  if (lastEffect === null) return;

  const firstEffect = lastEffect.next;
  let effect: Effect | null = firstEffect;
  do {
    if (effect === null) break;
    if ((effect.tag & flags) === flags) {
      const destroy = effect.destroy;
      effect.destroy = null;
      if (typeof destroy === "function") {
        destroy();
      }
    }
    effect = effect.next;
  } while (effect !== firstEffect);
}
