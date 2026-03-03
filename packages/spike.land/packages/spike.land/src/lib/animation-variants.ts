import type { Variants } from "framer-motion";

/**
 * Shared animation variants for consistent motion design across components.
 * These variants are designed for use with framer-motion's AnimatePresence and motion components.
 */

/**
 * Fade and scale animation - commonly used for modals, badges, and popup elements.
 */
export const fadeScaleVariants: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

/**
 * Slide up animation - used for content entering from below.
 */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

/**
 * Slide down animation - used for content entering from above.
 */
export const slideDownVariants: Variants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

/**
 * Subtle slide up - smaller movement for less prominent elements.
 */
export const subtleSlideUpVariants: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

/**
 * Scale pop animation - used for winner badges, success indicators.
 */
export const scalePopVariants: Variants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 },
};

/**
 * Default transition configurations for common animation patterns.
 */
export const transitions = {
  /** Standard transition for most animations */
  standard: { duration: 0.3 },
  /** Quick transition for micro-interactions */
  quick: { duration: 0.2 },
  /** Slow transition for emphasis */
  slow: { duration: 0.5 },
  /** Smooth easing for progress bars */
  smooth: { duration: 0.5, ease: "easeOut" as const },
  /** Spring animation for bouncy effects */
  spring: { type: "spring" as const, stiffness: 300, damping: 20 },
} as const;

/**
 * Gesture animation presets for interactive elements.
 */
export const gestures = {
  /** Standard hover scale effect */
  hoverScale: { scale: 1.05 },
  /** Prominent hover scale for larger elements */
  hoverScaleLarge: { scale: 1.1 },
  /** Tap/click press effect */
  tap: { scale: 0.95 },
  /** Subtle tap for small buttons */
  tapSubtle: { scale: 0.98 },
} as const;

/**
 * Creates a staggered delay transition for list animations.
 * @param index - The item's index in the list
 * @param baseDelay - The delay multiplier per item (default: 0.1s)
 */
export function staggerDelay(index: number, baseDelay = 0.1) {
  return { delay: index * baseDelay };
}

/**
 * Progress bar animation configuration.
 */
export const progressBarAnimation = {
  initial: { width: 0 },
  transition: { duration: 1.5, ease: "easeOut" as const },
};

/**
 * Cursor blink animation for typewriter effects.
 */
export const cursorBlinkAnimation = {
  animate: { opacity: [1, 0] },
  transition: { duration: 0.5, repeat: Infinity },
};
