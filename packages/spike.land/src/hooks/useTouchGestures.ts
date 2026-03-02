import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

/**
 * Options for touch gesture handling
 */
export interface UseTouchGesturesOptions {
  /** Callback for left swipe (next image) */
  onSwipeLeft: () => void;
  /** Callback for right swipe (previous image) */
  onSwipeRight: () => void;
  /** Optional callback for up swipe */
  onSwipeUp?: () => void;
  /** Optional callback for down swipe */
  onSwipeDown?: () => void;
  /** Optional callback for single tap */
  onTap?: () => void;
  /** Optional callback for double tap */
  onDoubleTap?: () => void;
  /** Callback when long press starts (for peek) */
  onLongPressStart?: () => void;
  /** Callback when long press ends */
  onLongPressEnd?: () => void;
  /** Minimum distance in pixels to trigger swipe (default: 50) */
  swipeThreshold?: number;
  /** Maximum time in ms for a swipe gesture (default: 300) */
  swipeMaxDuration?: number;
  /** Maximum delay in ms between taps for double tap (default: 300) */
  doubleTapDelay?: number;
  /** Time in ms to trigger long press (default: 500) */
  longPressDelay?: number;
  /** Control when touch handling is active */
  isEnabled: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

const DEFAULT_SWIPE_THRESHOLD = 50;
const DEFAULT_SWIPE_MAX_DURATION = 300;
const DEFAULT_DOUBLE_TAP_DELAY = 300;
const DEFAULT_LONG_PRESS_DELAY = 500;
const LONG_PRESS_MOVE_THRESHOLD = 10;

/**
 * Hook for handling touch gestures in gallery/slideshow views
 *
 * Supports:
 * - Horizontal swipes: Navigate between images
 * - Vertical swipes: Optional actions (e.g., zoom, dismiss)
 * - Single tap: Toggle controls
 * - Double tap: Zoom or fullscreen
 * - Long press: Hold to peek at original image
 *
 * @param elementRef - Reference to the element to attach touch handlers to
 * @param options - Configuration options with callbacks and settings
 */
export function useTouchGestures(
  elementRef: RefObject<HTMLElement | null>,
  options: UseTouchGesturesOptions,
): void {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPressStart,
    onLongPressEnd,
    swipeThreshold = DEFAULT_SWIPE_THRESHOLD,
    swipeMaxDuration = DEFAULT_SWIPE_MAX_DURATION,
    doubleTapDelay = DEFAULT_DOUBLE_TAP_DELAY,
    longPressDelay = DEFAULT_LONG_PRESS_DELAY,
    isEnabled,
  } = options;

  // Track touch state
  const touchStateRef = useRef<TouchState | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressingRef = useRef(false);
  const hasMoved = useRef(false);

  /**
   * Clear long press timer
   */
  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  /**
   * Handle touch start event
   */
  const handleTouchStart = useCallback(
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
      };
      hasMoved.current = false;

      // Start long press timer
      if (onLongPressStart) {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          // Timer is always cleared when hasMoved becomes true,
          // so if we reach here, hasMoved is guaranteed to be false
          isLongPressingRef.current = true;
          onLongPressStart();
        }, longPressDelay);
      }
    },
    [onLongPressStart, longPressDelay, clearLongPressTimer],
  );

  /**
   * Handle touch move event
   */
  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!touchStateRef.current) return;

      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - touchStateRef.current.startX);
      const deltaY = Math.abs(touch.clientY - touchStateRef.current.startY);

      // Cancel long press if moved too much
      if (deltaX > LONG_PRESS_MOVE_THRESHOLD || deltaY > LONG_PRESS_MOVE_THRESHOLD) {
        hasMoved.current = true;
        clearLongPressTimer();
      }
    },
    [clearLongPressTimer],
  );

  /**
   * Handle touch end event
   */
  const handleTouchEnd = useCallback(
    (event: TouchEvent) => {
      clearLongPressTimer();

      // Handle long press end
      if (isLongPressingRef.current) {
        isLongPressingRef.current = false;
        onLongPressEnd?.();
        touchStateRef.current = null;
        return;
      }

      if (!touchStateRef.current) return;

      const touch = event.changedTouches[0];
      if (!touch) {
        touchStateRef.current = null;
        return;
      }

      const deltaX = touch.clientX - touchStateRef.current.startX;
      const deltaY = touch.clientY - touchStateRef.current.startY;
      const duration = Date.now() - touchStateRef.current.startTime;

      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Check for swipe gesture
      const isSwipe = duration < swipeMaxDuration;

      if (isSwipe) {
        // Horizontal swipe takes priority if movement is more horizontal
        if (absDeltaX > swipeThreshold && absDeltaX > absDeltaY) {
          if (deltaX < 0) {
            onSwipeLeft();
          } else {
            onSwipeRight();
          }
          touchStateRef.current = null;
          return;
        }

        // Vertical swipe
        if (absDeltaY > swipeThreshold && absDeltaY > absDeltaX) {
          if (deltaY < 0 && onSwipeUp) {
            onSwipeUp();
          } else if (deltaY > 0 && onSwipeDown) {
            onSwipeDown();
          }
          touchStateRef.current = null;
          return;
        }
      }

      // Check for tap (no significant movement)
      if (absDeltaX < LONG_PRESS_MOVE_THRESHOLD && absDeltaY < LONG_PRESS_MOVE_THRESHOLD) {
        const now = Date.now();
        const timeSinceLastTap = now - lastTapTimeRef.current;

        if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
          // Double tap
          lastTapTimeRef.current = 0; // Reset to prevent triple tap
          onDoubleTap();
        } else {
          // Single tap
          lastTapTimeRef.current = now;
          onTap?.();
        }
      }

      touchStateRef.current = null;
    },
    [
      clearLongPressTimer,
      onLongPressEnd,
      swipeMaxDuration,
      swipeThreshold,
      onSwipeLeft,
      onSwipeRight,
      onSwipeUp,
      onSwipeDown,
      doubleTapDelay,
      onDoubleTap,
      onTap,
    ],
  );

  /**
   * Handle touch cancel event
   */
  const handleTouchCancel = useCallback(() => {
    clearLongPressTimer();

    if (isLongPressingRef.current) {
      isLongPressingRef.current = false;
      onLongPressEnd?.();
    }

    touchStateRef.current = null;
    hasMoved.current = false;
  }, [clearLongPressTimer, onLongPressEnd]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !isEnabled) {
      // Clean up timer when disabled (long press end is handled by cleanup function)
      clearLongPressTimer();
      return;
    }

    // Use passive event listeners for better scroll performance
    // except for touchmove which we may need to prevent default on
    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: true });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);

      // Clean up on unmount or when effect re-runs
      clearLongPressTimer();
      if (isLongPressingRef.current) {
        isLongPressingRef.current = false;
        onLongPressEnd?.();
      }
    };
  }, [
    elementRef,
    isEnabled,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    clearLongPressTimer,
    onLongPressEnd,
  ]);
}
