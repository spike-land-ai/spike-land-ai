import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useReducedMotion } from "framer-motion";
import type { ThemePreference } from "../hooks/useDarkMode";

// ─── Custom Spring physics from user's inspiration ───────────────────────────

function useSpring(target: number, k?: number, b?: number, m?: number) {
  const stiffness = k || 200;
  const damping = b || 22;
  const mass = m || 1;
  const [val, setVal] = useState(target);
  const s = useRef({ pos: target, vel: 0, raf: 0 as number, tgt: target });

  useEffect(() => {
    const state = s.current;
    state.tgt = target;
    if (state.raf) cancelAnimationFrame(state.raf);
    let prev: number | null = null;
    const tick = (now: number) => {
      if (!prev) prev = now;
      const dt = Math.min((now - prev) / 1000, 0.05);
      prev = now;
      const { pos, vel, tgt } = state;
      const a = (-stiffness * (pos - tgt) - damping * vel) / mass;
      state.vel = vel + a * dt;
      state.pos = pos + state.vel * dt;
      if (Math.abs(state.pos - tgt) < 0.001 && Math.abs(state.vel) < 0.001) {
        state.pos = tgt;
        state.vel = 0;
        setVal(tgt);
        return;
      }
      setVal(state.pos);
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(state.raf);
  }, [target, stiffness, damping, mass]);

  return val;
}

// ─── View Transition (full-page circular reveal) ─────────────────────────────

function triggerViewTransition(
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

// ─── SVGs from user's inspiration ───────────────────────────────────────────

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

function Sun({ rs }: { rs: number }) {
  return (
    <svg width="22" height="22" viewBox="-11 -11 22 22" style={{ overflow: "visible" }}>
      <circle r="5" fill="#f0a500" />
      {RAYS.map((deg) => {
        const r = (deg * Math.PI) / 180;
        const c = Math.cos(r), ss = Math.sin(r);
        const len = 4.2 * Math.max(0, rs);
        return (
          <line
            key={deg}
            x1={c * 7} y1={ss * 7}
            x2={c * (7 + len)} y2={ss * (7 + len)}
            stroke="#f0a500" strokeWidth="2.1" strokeLinecap="round"
            opacity={Math.max(0, rs)}
          />
        );
      })}
    </svg>
  );
}

function Moon({ sa }: { sa: number }) {
  const pts = [
    { x: 5.5, y: -7.5, r: 1.1 },
    { x: 9, y: -1.5, r: 0.8 },
    { x: 3.5, y: 4, r: 0.85 }
  ];
  return (
    <svg width="22" height="22" viewBox="-11 -11 22 22" style={{ overflow: "visible" }}>
      <path d="M0,-8 A8,8 0 1,0 8,0 A5.5,5.5 0 1,1 0,-8 Z" fill="#c8cfee" />
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x} cy={p.y} r={p.r}
          fill="#a8b0d8"
          opacity={Math.max(0, sa)}
        />
      ))}
    </svg>
  );
}

// ─── Main ThemeSwitcher ──────────────────────────────────────────────────────

interface ThemeSwitcherProps {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

export function ThemeSwitcher({ theme, setTheme }: ThemeSwitcherProps) {
  const isDark = theme === "dark";
  const prefersReduced = useReducedMotion();
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Springs matching the user's snippet physics
  const tx = useSpring(isDark ? 5 : 41, 260, 21, 0.85);
  const rs = useSpring(isDark ? 0 : 1, 150, 15, 0.9);
  const sa = useSpring(isDark ? 1 : 0, 140, 18, 0.9);
  const rot = useSpring(isDark ? 0 : 180, 200, 21, 0.8);

  const [rip, setRip] = useState(false);

  const handleToggle = useCallback(() => {
    setRip(false);
    requestAnimationFrame(() => setRip(true));

    const newTheme: ThemePreference = isDark ? "light" : "dark";
    const doToggle = () => setTheme(newTheme);

    if (prefersReduced) {
      doToggle();
      return;
    }
    triggerViewTransition(buttonRef, doToggle);
  }, [isDark, setTheme, prefersReduced]);

  const cssVars = isDark ? {
    "--trk": "#141b30",
    "--accent": "#4d6fff",
    "--thumb": "#e4e8f8",
    "--shad": "rgba(77,111,255,.55)",
    "--glow": "rgba(77,111,255,.18)"
  } : {
    "--trk": "#e4ddd0",
    "--accent": "#f0a500",
    "--thumb": "#fffdf8",
    "--shad": "rgba(240,165,0,.40)",
    "--glow": "rgba(240,165,0,.22)"
  };

  return (
    <button
      ref={buttonRef}
      className="toggle-insp"
      onClick={handleToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      style={cssVars as React.CSSProperties}
    >
      <div className="insp-halo" />
      <div key={rip ? 1 : 0} className={`insp-rip${rip ? " go" : ""}`} />
      <div className="insp-thumb" style={{ left: tx, transform: `rotate(${rot}deg)` }}>
        {isDark ? <Moon sa={sa} /> : <Sun rs={rs} />}
      </div>
    </button>
  );
}

// ─── View Transition CSS (injected once) ─────────────────────────────────────
if (typeof document !== "undefined") {
  const id = "theme-switcher-vt-styles";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      ::view-transition-old(root),
      ::view-transition-new(root) {
        animation: none;
        mix-blend-mode: normal;
      }
    `;
    document.head.appendChild(style);
  }
}
