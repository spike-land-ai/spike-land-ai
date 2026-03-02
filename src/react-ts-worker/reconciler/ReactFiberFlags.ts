export type Flags = number;

export const NoFlags = /*                      */ 0b0000000000000000000000000000000;
export const PerformedWork = /*                      */ 0b0000000000000000000000000000001;
export const Placement = /*                      */ 0b0000000000000000000000000000010;
export const Update = /*                      */ 0b0000000000000000000000000000100;
export const ChildDeletion = /*                      */ 0b0000000000000000000000000010000;
export const ContentReset = /*                      */ 0b0000000000000000000000000100000;
export const Callback = /*                      */ 0b0000000000000000000000001000000;
export const DidCapture = /*                      */ 0b0000000000000000000000010000000;
export const ForceClientRender = /*                    */ 0b0000000000000000000000100000000;
export const Ref = /*                      */ 0b0000000000000000000001000000000;
export const Snapshot = /*                      */ 0b0000000000000000000010000000000;
export const Passive = /*                      */ 0b0000000000000000000100000000000;
export const Hydrating = /*                      */ 0b0000000000000000001000000000000;
export const Visibility = /*                      */ 0b0000000000000000010000000000000;
export const StoreConsistency = /*                     */ 0b0000000000000000100000000000000;

export const LifecycleEffectMask = Passive | Update | Callback | Ref | Snapshot | StoreConsistency;

export const HostEffectMask = /*                      */ 0b0000000000000000111111111111111;

export const Incomplete = /*                      */ 0b0000000000000001000000000000000;
export const ShouldCapture = /*                      */ 0b0000000000000010000000000000000;

export const LayoutStatic = /*                      */ 0b0000000010000000000000000000000;
export const RefStatic = LayoutStatic;
export const PassiveStatic = /*                      */ 0b0000000100000000000000000000000;

export const BeforeMutationMask = Snapshot;

export const MutationMask =
  Placement | Update | ChildDeletion | ContentReset | Ref | Hydrating | Visibility;

export const LayoutMask = Update | Callback | Ref | Visibility;

export const PassiveMask = Passive | Visibility | ChildDeletion;

export const StaticMask = LayoutStatic | PassiveStatic | RefStatic;
