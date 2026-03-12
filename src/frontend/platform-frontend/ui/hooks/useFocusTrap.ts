import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Returns `true` when `el` is an `HTMLElement` that can receive `.focus()`.
 * Use this guard instead of a bare `as HTMLElement` cast when the source is
 * `document.activeElement` (which has type `Element | null`).
 */
function isHTMLElement(el: Element | null): el is HTMLElement {
  return el instanceof HTMLElement;
}

/**
 * Traps keyboard focus within a container element when `active` is `true`.
 *
 * - Moves focus to the first focusable child on activation.
 * - Cycles focus on Tab / Shift+Tab at the boundary.
 * - Calls `onClose` and restores focus to the trigger element on Escape.
 *
 * @param active - Whether the focus trap should currently be active.
 * @param onClose - Optional callback invoked when the Escape key is pressed.
 * @returns A ref to attach to the container `<div>`.
 */
export function useFocusTrap(active: boolean, onClose?: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const activeEl = document.activeElement;
    triggerRef.current = isHTMLElement(activeEl) ? activeEl : null;

    const container = containerRef.current;
    if (!container) return;

    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusables()[0];
    first?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && onClose) {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const els = focusables();
      if (els.length === 0) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (!firstEl || !lastEl) return;

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [active, onClose]);

  return containerRef;
}
