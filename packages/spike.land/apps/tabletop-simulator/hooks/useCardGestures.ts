import type { ThreeEvent } from "@react-three/fiber";
import { useDrag } from "@use-gesture/react";
import { useRef } from "react";

export function useCardGestures(
  id: string,
  onMove: (id: string, pos: { x: number; y: number; z: number }) => void,
  onFlip: (id: string) => void,
  onGrab?: (id: string) => void,
  onRelease?: (id: string) => void,
) {
  // Track if we're currently grabbing to avoid duplicate calls
  const isGrabbing = useRef(false);

  const bind = useDrag(
    ({ active, event, tap, first, last }) => {
      // Cast event to ThreeEvent to access 3D point
      const e = event as unknown as ThreeEvent<PointerEvent>;
      e.stopPropagation();

      if (tap) {
        onFlip(id);
        return;
      }

      // Handle grab on first drag frame
      if (first && !isGrabbing.current) {
        isGrabbing.current = true;
        onGrab?.(id);
      }

      // Handle release on last drag frame
      if (last && isGrabbing.current) {
        isGrabbing.current = false;
        onRelease?.(id);
      }

      if (active) {
        // In a real implementation, we'd use the point from the event raycast
        // But event.point is the point on the object itself usually.
        // To drag properly, we need a floor plane raycast.
        // For MVP, simple logic:
        const point = e.point;
        // We assume dragging on table surface (y~0)
        if (point) {
          onMove(id, { x: point.x, y: point.y + 0.1, z: point.z });
        }
      }
    },
    {
      filterTaps: true,
      delay: true,
    },
  );

  return bind;
}
