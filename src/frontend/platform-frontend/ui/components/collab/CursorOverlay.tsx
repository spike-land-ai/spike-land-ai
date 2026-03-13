/**
 * CursorOverlay — fixed overlay that shows remote users' cursors on the page.
 *
 * Each cursor renders as a colored dot + username label. Cursor positions are
 * stored as viewport-relative [0,1] fractions so they map correctly at any
 * window size. Movement is smoothed via CSS transition. A cursor fades out
 * after 5 s of inactivity and is removed from the DOM after the fade.
 *
 * Usage:
 *   // Place once at the root inside <CollabProvider>
 *   <CursorOverlay />
 *
 *   // Wire up pointer events from wherever makes sense:
 *   const { sendCursorUpdate } = useCollab();
 *   <div onPointerMove={(e) => {
 *     sendCursorUpdate(e.clientX / window.innerWidth, e.clientY / window.innerHeight);
 *   }} />
 */
import { memo, useEffect, useRef, useState } from "react";
import { useCollab } from "./CollabProvider";
import type { CollabUser } from "./CollabProvider";

const FADE_AFTER_MS = 5_000;
const FADE_DURATION_MS = 600;

interface CursorState {
  user: CollabUser;
  /** px position derived from fractional coords + current viewport size */
  x: number;
  y: number;
  /** timestamp of last cursor update */
  updatedAt: number;
  fading: boolean;
}

function fractionalToPixels(fx: number, fy: number): { x: number; y: number } {
  return {
    x: fx * window.innerWidth,
    y: fy * window.innerHeight,
  };
}

const CursorDot = memo(function CursorDot({ state }: { state: CursorState }) {
  const { user, x, y, fading } = state;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: "translate(-4px, -4px)",
        pointerEvents: "none",
        zIndex: 9999,
        transition: "left 80ms linear, top 80ms linear",
        opacity: fading ? 0 : 1,
        transitionProperty: fading ? "opacity" : "left, top, opacity",
        transitionDuration: fading ? `${FADE_DURATION_MS}ms` : "80ms",
      }}
    >
      {/* Cursor SVG arrow */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
      >
        <path
          d="M3 2L17 9.5L10.5 11.5L8 18L3 2Z"
          fill={user.color}
          stroke="white"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Name label */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 12,
          backgroundColor: user.color,
          color: "#fff",
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1,
          paddingTop: 3,
          paddingBottom: 3,
          paddingLeft: 6,
          paddingRight: 6,
          borderRadius: 4,
          whiteSpace: "nowrap",
          boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {user.name}
      </div>
    </div>
  );
});

export function CursorOverlay() {
  const { users } = useCollab();
  const [cursors, setCursors] = useState<Map<string, CursorState>>(new Map());
  const fadeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const removeTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const now = Date.now();

    setCursors((prev) => {
      const next = new Map(prev);

      // Update or add cursors for users with a cursor position
      for (const user of users) {
        if (!user.cursor) continue;
        const { x, y } = fractionalToPixels(user.cursor.x, user.cursor.y);
        const existing = next.get(user.userId);

        if (
          existing &&
          existing.user.cursor?.x === user.cursor.x &&
          existing.user.cursor?.y === user.cursor.y
        ) {
          // Position unchanged — just refresh user metadata
          next.set(user.userId, { ...existing, user });
          continue;
        }

        next.set(user.userId, {
          user,
          x,
          y,
          updatedAt: now,
          fading: false,
        });

        // Reset fade timer
        const existingFade = fadeTimers.current.get(user.userId);
        if (existingFade) clearTimeout(existingFade);

        const existingRemove = removeTimers.current.get(user.userId);
        if (existingRemove) clearTimeout(existingRemove);

        fadeTimers.current.set(
          user.userId,
          setTimeout(() => {
            setCursors((c) => {
              const m = new Map(c);
              const cur = m.get(user.userId);
              if (cur) m.set(user.userId, { ...cur, fading: true });
              return m;
            });

            removeTimers.current.set(
              user.userId,
              setTimeout(() => {
                setCursors((c) => {
                  const m = new Map(c);
                  m.delete(user.userId);
                  return m;
                });
                fadeTimers.current.delete(user.userId);
                removeTimers.current.delete(user.userId);
              }, FADE_DURATION_MS),
            );
          }, FADE_AFTER_MS),
        );
      }

      // Remove cursors for users who have gone offline
      const onlineIds = new Set(users.map((u) => u.userId));
      for (const uid of next.keys()) {
        if (!onlineIds.has(uid)) {
          const cur = next.get(uid);
          if (cur && !cur.fading) {
            next.set(uid, { ...cur, fading: true });
          }
        }
      }

      return next;
    });
  }, [users]);

  useEffect(() => {
    return () => {
      for (const t of fadeTimers.current.values()) clearTimeout(t);
      for (const t of removeTimers.current.values()) clearTimeout(t);
    };
  }, []);

  return (
    <>
      {Array.from(cursors.values()).map((state) => (
        <CursorDot key={state.user.userId} state={state} />
      ))}
    </>
  );
}
