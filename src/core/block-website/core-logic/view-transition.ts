import { flushSync } from "react-dom";

/**
 * Triggers a View Transition API circular reveal animation from a button position.
 * Falls back to instant callback execution when API is unavailable.
 */
export function triggerViewTransition(
  buttonRef: React.RefObject<HTMLElement | null>,
  callback: () => void,
) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void> };
  };

  if (!doc.startViewTransition || !buttonRef.current) {
    callback();
    return;
  }

  const { top, left, width, height } = buttonRef.current.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const maxRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  const transition = doc.startViewTransition(() => {
    flushSync(callback);
  });

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: 450,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });
}
