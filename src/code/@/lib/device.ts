export function detectSlowDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  // hardwareConcurrency gives the number of logical processors.
  // 4 is a reasonable threshold for "slow" in a modern context.
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;

  // deviceMemory gives the RAM in GB (approximate/clamped).
  // @ts-expect-error - deviceMemory is not in standard TS lib yet
  const deviceMemory = navigator.deviceMemory ?? 4;

  return hardwareConcurrency < 4 || deviceMemory < 4;
}
