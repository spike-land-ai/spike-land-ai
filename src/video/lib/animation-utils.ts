/**
 * Shared animation utilities for video components
 */

/**
 * Linearly interpolates a value between input and output ranges
 */
export const interpolate = (val: number, input: number[], output: number[]) => {
  if (!input.length || !output.length) return 0;
  if (val <= (input[0] ?? 0)) return output[0] ?? 0;
  if (val >= (input[input.length - 1] ?? 0)) {
    return output[output.length - 1] ?? 0;
  }

  for (let i = 0; i < input.length - 1; i++) {
    const iVal = input[i] ?? 0;
    const iNextVal = input[i + 1] ?? 0;
    const oVal = output[i] ?? 0;
    const oNextVal = output[i + 1] ?? 0;

    if (val >= iVal && val <= iNextVal) {
      // Guard against division by zero (C2)
      const p = (val - iVal) / (iNextVal - iVal || 1);
      return oVal + p * (oNextVal - oVal);
    }
  }
  return output[0] ?? 0;
};

/**
 * Clamps a value between min and max
 */
export const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

/**
 * Deterministic seeded random number generator
 */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
