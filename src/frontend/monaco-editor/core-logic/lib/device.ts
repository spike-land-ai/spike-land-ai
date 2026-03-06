declare global {
  interface Navigator {
    /** RAM in GB (approximate/clamped). Part of Device Memory API (not yet in TS lib). */
    readonly deviceMemory?: number;
  }
}

export function detectSlowDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  // hardwareConcurrency gives the number of logical processors.
  // 4 is a reasonable threshold for "slow" in a modern context.
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;

  // deviceMemory gives the RAM in GB (approximate/clamped).
  const deviceMemory = navigator.deviceMemory ?? 4;

  return hardwareConcurrency < 4 || deviceMemory < 4;
}
