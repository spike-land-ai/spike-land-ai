/**
 * Animation duration constants for gallery transitions (in milliseconds).
 */
export const ANIMATION_DURATIONS = {
  /** Duration for hero image expand animation */
  heroExpand: 400,
  /** Duration for hero image collapse animation */
  heroCollapse: 400,
  /** Duration for grid fade in/out animation */
  gridFade: 300,
  /** Duration for thumbnail swap animation */
  thumbnailSwap: 200,
  /** Duration for peek transition animation */
  peekTransition: 150,
} as const;

/**
 * Animation easing functions for consistent motion design.
 */
export const ANIMATION_EASINGS = {
  /** Standard easing for most animations */
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  /** Easing for elements entering the screen */
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  /** Easing for elements leaving the screen */
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  /** Elastic easing for playful interactions */
  elastic: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

/**
 * Result of FLIP animation transform calculation.
 */
interface HeroTransform {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
}

/**
 * Calculates the transform values needed for FLIP (First, Last, Invert, Play) animation.
 * Used to animate from a thumbnail position to a full-screen hero position.
 *
 * @param fromRect - The bounding rectangle of the source element (thumbnail)
 * @param toRect - The bounding rectangle of the target element (hero container).
 *                 Defaults to viewport dimensions if not provided.
 * @returns Transform values (x, y translation and scale factors)
 *
 * @example
 * ```typescript
 * const thumbnailRect = thumbnailElement.getBoundingClientRect();
 * const transform = calculateHeroTransform(thumbnailRect);
 * // Use transform values as CSS custom properties
 * element.style.setProperty('--hero-x', `${transform.x}px`);
 * element.style.setProperty('--hero-y', `${transform.y}px`);
 * element.style.setProperty('--hero-scale', `${transform.scaleX}`);
 * ```
 */
export function calculateHeroTransform(
  fromRect: DOMRect,
  toRect?: DOMRect,
): HeroTransform {
  // Default to viewport dimensions if toRect is not provided
  const targetRect = toRect ?? {
    x: 0,
    y: 0,
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  };

  // Calculate the center points of both rectangles
  const fromCenterX = fromRect.x + fromRect.width / 2;
  const fromCenterY = fromRect.y + fromRect.height / 2;
  const toCenterX = targetRect.x + targetRect.width / 2;
  const toCenterY = targetRect.y + targetRect.height / 2;

  // Calculate translation from hero center to thumbnail center
  const x = fromCenterX - toCenterX;
  const y = fromCenterY - toCenterY;

  // Calculate scale factors
  const scaleX = fromRect.width / targetRect.width;
  const scaleY = fromRect.height / targetRect.height;

  return { x, y, scaleX, scaleY };
}

/**
 * CSS custom property names for hero transform animation.
 */
export const HERO_TRANSFORM_CSS_VARS = {
  x: "--hero-x",
  y: "--hero-y",
  scaleX: "--hero-scale-x",
  scaleY: "--hero-scale-y",
  scale: "--hero-scale",
} as const;

/**
 * Applies hero transform CSS custom properties to an element.
 *
 * @param element - The DOM element to apply properties to
 * @param transform - The calculated transform values
 */
export function applyHeroTransformStyles(
  element: HTMLElement,
  transform: HeroTransform,
): void {
  element.style.setProperty(HERO_TRANSFORM_CSS_VARS.x, `${transform.x}px`);
  element.style.setProperty(HERO_TRANSFORM_CSS_VARS.y, `${transform.y}px`);
  element.style.setProperty(
    HERO_TRANSFORM_CSS_VARS.scaleX,
    `${transform.scaleX}`,
  );
  element.style.setProperty(
    HERO_TRANSFORM_CSS_VARS.scaleY,
    `${transform.scaleY}`,
  );
  // Use uniform scale (average of X and Y) for simpler animations
  element.style.setProperty(
    HERO_TRANSFORM_CSS_VARS.scale,
    `${(transform.scaleX + transform.scaleY) / 2}`,
  );
}

/**
 * Clears hero transform CSS custom properties from an element.
 *
 * @param element - The DOM element to clear properties from
 */
export function clearHeroTransformStyles(element: HTMLElement): void {
  element.style.removeProperty(HERO_TRANSFORM_CSS_VARS.x);
  element.style.removeProperty(HERO_TRANSFORM_CSS_VARS.y);
  element.style.removeProperty(HERO_TRANSFORM_CSS_VARS.scaleX);
  element.style.removeProperty(HERO_TRANSFORM_CSS_VARS.scaleY);
  element.style.removeProperty(HERO_TRANSFORM_CSS_VARS.scale);
}
