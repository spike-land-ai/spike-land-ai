import { useCallback, useEffect, useRef } from "react";

/**
 * Options for keyboard navigation handling
 */
export interface UseKeyboardNavigationOptions {
  /** Callback for spacebar press (toggle play/pause) */
  onSpacebar: () => void;
  /** Callback for left arrow press (previous image) */
  onLeftArrow: () => void;
  /** Callback for right arrow press (next image) */
  onRightArrow: () => void;
  /** Optional callback for up arrow press */
  onUpArrow?: () => void;
  /** Optional callback for down arrow press */
  onDownArrow?: () => void;
  /** Callback for B key down (start peek at original) */
  onBKeyDown: () => void;
  /** Callback for B key up (end peek at original) */
  onBKeyUp: () => void;
  /** Callback for Escape key press (exit fullscreen/close) */
  onEscape: () => void;
  /** Control when keyboard handling is active */
  isEnabled: boolean;
}

/**
 * Hook for handling keyboard navigation in gallery/slideshow views
 *
 * Supports:
 * - Spacebar: Toggle play/pause
 * - Left/Right arrows: Navigate between images
 * - Up/Down arrows: Optional navigation (e.g., volume, zoom)
 * - B key: Hold to peek at original image
 * - Escape: Exit fullscreen or close modal
 *
 * @param options - Configuration options with callbacks and enabled state
 */
export function useKeyboardNavigation(options: UseKeyboardNavigationOptions): void {
  const {
    onSpacebar,
    onLeftArrow,
    onRightArrow,
    onUpArrow,
    onDownArrow,
    onBKeyDown,
    onBKeyUp,
    onEscape,
    isEnabled,
  } = options;

  // Track if B key is currently held down to prevent repeat events
  const isBKeyHeldRef = useRef(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore key events when typing in input elements
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      switch (event.code) {
        case "Space":
          event.preventDefault();
          onSpacebar();
          break;
        case "ArrowLeft":
          event.preventDefault();
          onLeftArrow();
          break;
        case "ArrowRight":
          event.preventDefault();
          onRightArrow();
          break;
        case "ArrowUp":
          if (onUpArrow) {
            event.preventDefault();
            onUpArrow();
          }
          break;
        case "ArrowDown":
          if (onDownArrow) {
            event.preventDefault();
            onDownArrow();
          }
          break;
        case "KeyB":
          event.preventDefault();
          // Only trigger on initial press, not repeat
          if (!isBKeyHeldRef.current) {
            isBKeyHeldRef.current = true;
            onBKeyDown();
          }
          break;
        case "Escape":
          event.preventDefault();
          onEscape();
          break;
      }
    },
    [onSpacebar, onLeftArrow, onRightArrow, onUpArrow, onDownArrow, onBKeyDown, onEscape],
  );

  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      if (event.code === "KeyB") {
        event.preventDefault();
        if (isBKeyHeldRef.current) {
          isBKeyHeldRef.current = false;
          onBKeyUp();
        }
      }
    },
    [onBKeyUp],
  );

  useEffect(() => {
    if (!isEnabled) {
      // Reset B key state when disabled
      isBKeyHeldRef.current = false;
      return;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      // Reset B key state on cleanup
      isBKeyHeldRef.current = false;
    };
  }, [isEnabled, handleKeyDown, handleKeyUp]);
}
