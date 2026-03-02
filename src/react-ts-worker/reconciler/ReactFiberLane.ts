export type Lanes = number;
export type Lane = number;
export type LaneMap<T> = Array<T>;

export const TotalLanes = 31;

export const NoLanes: Lanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane: Lane = /*                        */ 0b0000000000000000000000000000000;

export const SyncLane: Lane = /*                        */ 0b0000000000000000000000000000010;

export const InputContinuousLane: Lane = /*                */ 0b0000000000000000000000000001000;

export const DefaultLane: Lane = /*                        */ 0b0000000000000000000000000100000;

export const SyncUpdateLanes: Lanes = SyncLane | InputContinuousLane | DefaultLane;

const TransitionLanes: Lanes = /*                        */ 0b0000000001111111111111100000000;
const TransitionLane1: Lane = /*                        */ 0b0000000000000000000000100000000;

const RetryLanes: Lanes = /*                        */ 0b0000011110000000000000000000000;
const RetryLane1: Lane = /*                        */ 0b0000000010000000000000000000000;

export const IdleLane: Lane = /*                        */ 0b0010000000000000000000000000000;
export const OffscreenLane: Lane = /*                      */ 0b0100000000000000000000000000000;
export const DeferredLane: Lane = /*                       */ 0b1000000000000000000000000000000;

const NonIdleLanes: Lanes = /*                        */ 0b0000111111111111111111111111111;

export const NoTimestamp = -1;

let nextTransitionLane: Lane = TransitionLane1;
let nextRetryLane: Lane = RetryLane1;

export function getHighestPriorityLane(lanes: Lanes): Lane {
  return lanes & -lanes;
}

export function includesSomeLane(a: Lanes | Lane, b: Lanes | Lane): boolean {
  return (a & b) !== NoLanes;
}

export function isSubsetOfLanes(set: Lanes, subset: Lanes | Lane): boolean {
  return (set & subset) === subset;
}

export function mergeLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a | b;
}

export function removeLanes(set: Lanes, subset: Lanes | Lane): Lanes {
  return set & ~subset;
}

export function intersectLanes(a: Lanes | Lane, b: Lanes | Lane): Lanes {
  return a & b;
}

export function laneToLanes(lane: Lane): Lanes {
  return lane;
}

export function includesNonIdleWork(lanes: Lanes): boolean {
  return (lanes & NonIdleLanes) !== NoLanes;
}

export function includesBlockingLane(lanes: Lanes): boolean {
  const SyncDefaultLanes = SyncLane | InputContinuousLane | DefaultLane;
  return (lanes & SyncDefaultLanes) !== NoLanes;
}

export function includesTransitionLane(lanes: Lanes): boolean {
  return (lanes & TransitionLanes) !== NoLanes;
}

export function includesOnlyNonUrgentLanes(lanes: Lanes): boolean {
  const UrgentLanes = SyncLane | InputContinuousLane | DefaultLane;
  return (lanes & UrgentLanes) === NoLanes;
}

export function includesOnlyTransitions(lanes: Lanes): boolean {
  return (lanes & TransitionLanes) === lanes;
}

export function claimNextTransitionLane(): Lane {
  const lane = nextTransitionLane;
  nextTransitionLane <<= 1;
  if ((nextTransitionLane & TransitionLanes) === NoLanes) {
    nextTransitionLane = TransitionLane1;
  }
  return lane;
}

export function claimNextRetryLane(): Lane {
  const lane = nextRetryLane;
  nextRetryLane <<= 1;
  if ((nextRetryLane & RetryLanes) === NoLanes) {
    nextRetryLane = RetryLane1;
  }
  return lane;
}

export function pickArbitraryLane(lanes: Lanes): Lane {
  return getHighestPriorityLane(lanes);
}

export function createLaneMap<T>(initial: T): LaneMap<T> {
  const laneMap: LaneMap<T> = [];
  for (let i = 0; i < TotalLanes; i++) {
    laneMap.push(initial);
  }
  return laneMap;
}

export function markRootUpdated(
  root: { pendingLanes: Lanes; suspendedLanes: Lanes; pingedLanes: Lanes },
  updateLane: Lane,
): void {
  root.pendingLanes |= updateLane;
  if (updateLane !== IdleLane) {
    root.suspendedLanes = NoLanes;
    root.pingedLanes = NoLanes;
  }
}

export function markRootFinished(
  root: {
    pendingLanes: Lanes;
    suspendedLanes: Lanes;
    pingedLanes: Lanes;
    entangledLanes: Lanes;
    expiredLanes: Lanes;
  },
  remainingLanes: Lanes,
): void {
  root.pendingLanes = remainingLanes;
  root.suspendedLanes = NoLanes;
  root.pingedLanes = NoLanes;
  root.expiredLanes &= remainingLanes;
  root.entangledLanes &= remainingLanes;
}

export function getNextLanes(
  root: { pendingLanes: Lanes; suspendedLanes: Lanes; pingedLanes: Lanes },
  _wipLanes: Lanes,
): Lanes {
  const pendingLanes = root.pendingLanes;
  if (pendingLanes === NoLanes) {
    return NoLanes;
  }

  let nextLanes: Lanes = NoLanes;

  const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
  if (nonIdlePendingLanes !== NoLanes) {
    const nonIdleUnblockedLanes = nonIdlePendingLanes & ~root.suspendedLanes;
    if (nonIdleUnblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLane(nonIdleUnblockedLanes);
    } else {
      const nonIdlePingedLanes = nonIdlePendingLanes & root.pingedLanes;
      if (nonIdlePingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLane(nonIdlePingedLanes);
      }
    }
  } else {
    const unblockedLanes = pendingLanes & ~root.suspendedLanes;
    if (unblockedLanes !== NoLanes) {
      nextLanes = getHighestPriorityLane(unblockedLanes);
    } else {
      if (root.pingedLanes !== NoLanes) {
        nextLanes = getHighestPriorityLane(root.pingedLanes);
      }
    }
  }

  if (nextLanes === NoLanes) {
    return NoLanes;
  }

  return nextLanes;
}

export function getEntangledLanes(
  root: { entangledLanes: Lanes; entanglements: LaneMap<Lanes> },
  renderLanes: Lanes,
): Lanes {
  let entangledLanes = renderLanes;

  if ((entangledLanes & InputContinuousLane) !== NoLanes) {
    entangledLanes |= entangledLanes & DefaultLane;
  }

  const allEntangledLanes = root.entangledLanes;
  if (allEntangledLanes !== NoLanes) {
    const entanglements = root.entanglements;
    let lanes = entangledLanes & allEntangledLanes;
    while (lanes > 0) {
      const index = 31 - Math.clz32(lanes);
      const lane = 1 << index;
      entangledLanes |= entanglements[index] ?? 0;
      lanes &= ~lane;
    }
  }

  return entangledLanes;
}

export function markRootPinged(
  root: { pingedLanes: Lanes; suspendedLanes: Lanes },
  pingedLanes: Lanes,
): void {
  root.pingedLanes |= root.suspendedLanes & pingedLanes;
}

export function higherPriorityLane(a: Lane, b: Lane): Lane {
  return a !== NoLane && a < b ? a : b;
}
