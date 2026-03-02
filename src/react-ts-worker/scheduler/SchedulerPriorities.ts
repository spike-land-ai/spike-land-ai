export type PriorityLevel = 0 | 1 | 2 | 3 | 4 | 5;

export const NoPriority: PriorityLevel = 0;
export const ImmediatePriority: PriorityLevel = 1;
export const UserBlockingPriority: PriorityLevel = 2;
export const NormalPriority: PriorityLevel = 3;
export const LowPriority: PriorityLevel = 4;
export const IdlePriority: PriorityLevel = 5;

// Timeout constants (ms)
export const IMMEDIATE_PRIORITY_TIMEOUT = -1;
export const USER_BLOCKING_PRIORITY_TIMEOUT = 250;
export const NORMAL_PRIORITY_TIMEOUT = 5000;
export const LOW_PRIORITY_TIMEOUT = 10000;
export const IDLE_PRIORITY_TIMEOUT = 1073741823; // max signed 31-bit int
