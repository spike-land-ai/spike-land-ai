import { Easing, interpolate, spring } from "remotion";
import { SPRING_CONFIGS } from "./constants";

type SpringConfig = {
  damping?: number;
  stiffness?: number;
  mass?: number;
};

/**
 * Create a smooth fade-in animation
 */
export function fadeIn(
  frame: number,
  fps: number,
  durationSeconds: number = 0.5,
  delay: number = 0,
): number {
  return interpolate(frame, [delay, delay + durationSeconds * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
}

/**
 * Create a fade-out animation
 */
export function fadeOut(
  frame: number,
  fps: number,
  startFrame: number,
  durationSeconds: number = 0.5,
): number {
  return interpolate(frame, [startFrame, startFrame + durationSeconds * fps], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });
}

/**
 * Create a spring-based scale animation (0 to 1)
 */
export function springScale(
  frame: number,
  fps: number,
  config: SpringConfig = SPRING_CONFIGS.snappy,
  delay: number = 0,
): number {
  return spring({
    frame: frame - delay,
    fps,
    config,
  });
}

/**
 * Create a slide-in animation from a direction
 */
export function slideIn(
  frame: number,
  fps: number,
  direction: "left" | "right" | "top" | "bottom" = "bottom",
  distance: number = 100,
  durationSeconds: number = 0.5,
  delay: number = 0,
): number {
  const progress = interpolate(frame, [delay, delay + durationSeconds * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const offset = interpolate(progress, [0, 1], [distance, 0]);

  switch (direction) {
    case "left":
      return -offset;
    case "right":
      return offset;
    case "top":
      return -offset;
    case "bottom":
      return offset;
  }
}

/**
 * Count up animation for numbers
 */
export function countUp(
  frame: number,
  fps: number,
  targetValue: number,
  durationSeconds: number = 1,
  delay: number = 0,
): number {
  const progress = interpolate(frame, [delay, delay + durationSeconds * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return Math.round(progress * targetValue);
}

/**
 * Staggered animation helper - returns delay for each item
 */
export function stagger(
  index: number,
  staggerAmount: number = 5, // frames between each item
): number {
  return index * staggerAmount;
}

/**
 * Typewriter effect - returns the visible portion of text
 */
export function typewriter(
  frame: number,
  fps: number,
  text: string,
  charsPerSecond: number = 30,
  delay: number = 0,
): string {
  const elapsedFrames = Math.max(0, frame - delay);
  const elapsedSeconds = elapsedFrames / fps;
  const visibleChars = Math.floor(elapsedSeconds * charsPerSecond);
  return text.slice(0, visibleChars);
}

/**
 * Pulse animation (for glowing effects)
 */
export function pulse(
  frame: number,
  fps: number,
  frequency: number = 2, // pulses per second
): number {
  const phase = (frame / fps) * frequency * Math.PI * 2;
  return (Math.sin(phase) + 1) / 2; // Normalized 0-1
}

/**
 * Glitch offset - creates random-looking but deterministic offset
 */
export function glitchOffset(frame: number, maxOffset: number = 10, seed: number = 0): number {
  // Pseudo-random based on frame and seed
  const hash = Math.sin((frame + seed) * 12.9898) * 43758.5453;
  return ((hash - Math.floor(hash)) * 2 - 1) * maxOffset;
}

/**
 * Progress bar animation
 */
export function progressBar(
  frame: number,
  startFrame: number,
  endFrame: number,
  startValue: number = 0,
  endValue: number = 100,
): number {
  return interpolate(frame, [startFrame, endFrame], [startValue, endValue], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
}

/**
 * Bar chart growth animation
 */
export function barGrow(
  frame: number,
  fps: number,
  targetHeight: number,
  delay: number = 0,
  durationSeconds: number = 0.8,
): number {
  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
    durationInFrames: durationSeconds * fps,
  });

  return targetHeight * progress;
}

/**
 * RGB split effect values
 */
export function rgbSplit(
  frame: number,
  intensity: number = 5,
  phase: number = 0,
): {
  r: { x: number; y: number };
  g: { x: number; y: number };
  b: { x: number; y: number };
} {
  const offset = glitchOffset(frame, intensity, phase);
  return {
    r: { x: offset, y: offset * 0.5 },
    g: { x: 0, y: 0 },
    b: { x: -offset, y: -offset * 0.5 },
  };
}

/**
 * Shake animation
 */
export function shake(
  frame: number,
  intensity: number = 5,
  frequency: number = 30,
): { x: number; y: number } {
  const x = glitchOffset(frame * frequency, intensity, 0);
  const y = glitchOffset(frame * frequency, intensity, 100);
  return { x, y };
}

/**
 * Bezier path interpolation for smooth curved movement
 * Returns {x, y} position along a cubic bezier curve
 */
export function bezierPath(
  progress: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
): { x: number; y: number } {
  const t = Math.max(0, Math.min(1, progress));
  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Radial clip path progress for circular reveal effects
 * Returns CSS clipPath string for a circular wipe
 */
export function radialClipPath(
  progress: number,
  centerX: number = 50,
  centerY: number = 50,
): string {
  const radius = progress * 150; // 150% to fully cover corners
  return `circle(${radius}% at ${centerX}% ${centerY}%)`;
}
