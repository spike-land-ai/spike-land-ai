import { useCallback, useEffect, useRef, useState } from "react";

function useSpring(target: number, k = 200, b = 22, m = 1) {
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
      const a = (-k * (pos - tgt) - b * vel) / m;
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
  }, [target, k, b, m]);

  return val;
}

const RAYS = [0, 45, 90, 135, 180, 225, 270, 315];

function Sun({ rs }: { rs: number }) {
  return (
    <svg width="20" height="20" viewBox="-11 -11 22 22" style={{ overflow: "visible" }}>
      <circle r="5" fill="#f0a500" />
      {RAYS.map((deg) => {
        const r = (deg * Math.PI) / 180;
        const c = Math.cos(r),
          ss = Math.sin(r);
        const len = 4.2 * Math.max(0, rs);
        return (
          <line
            key={deg}
            x1={c * 7}
            y1={ss * 7}
            x2={c * (7 + len)}
            y2={ss * (7 + len)}
            stroke="#f0a500"
            strokeWidth="2.1"
            strokeLinecap="round"
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
    { x: 3.5, y: 4, r: 0.85 },
  ];
  return (
    <svg width="20" height="20" viewBox="-11 -11 22 22" style={{ overflow: "visible" }}>
      <path d="M0,-8 A8,8 0 1,0 8,0 A5.5,5.5 0 1,1 0,-8 Z" fill="#c8cfee" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="#a8b0d8" opacity={Math.max(0, sa)} />
      ))}
    </svg>
  );
}

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "theme-preference") {
        setIsDark(e.newValue === "dark");
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const tx = useSpring(isDark ? 5 : 41, 260, 21, 0.85);
  const rs = useSpring(isDark ? 0 : 1, 150, 15, 0.9);
  const sa = useSpring(isDark ? 1 : 0, 140, 18, 0.9);
  const rot = useSpring(isDark ? 0 : 180, 200, 21, 0.8);

  const handleToggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme-preference", next ? "dark" : "light");
  }, [isDark]);

  const cssVars = isDark
    ? {
        "--trk": "#141b30",
        "--accent": "#4d6fff",
        "--thumb": "#e4e8f8",
        "--shad": "rgba(77,111,255,.55)",
        "--glow": "rgba(77,111,255,.18)",
      }
    : {
        "--trk": "#e4ddd0",
        "--accent": "#f0a500",
        "--thumb": "#fffdf8",
        "--shad": "rgba(240,165,0,.40)",
        "--glow": "rgba(240,165,0,.22)",
      };

  return (
    <>
      <style>{`
        .theme-toggle {
          position: relative;
          width: 72px;
          height: 36px;
          border-radius: 18px;
          background: var(--trk);
          border: none;
          cursor: pointer;
          padding: 0;
          box-shadow: 0 0 0 1px rgba(0,0,0,.08), inset 0 1px 2px rgba(0,0,0,.12);
          transition: background 0.3s ease;
        }
        .theme-toggle:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }
        .toggle-halo {
          position: absolute;
          inset: -4px;
          border-radius: 22px;
          background: radial-gradient(circle, var(--glow) 0%, transparent 70%);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
        }
        .theme-toggle:hover .toggle-halo { opacity: 1; }
        .toggle-thumb {
          position: absolute;
          top: 4px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--thumb);
          box-shadow: 0 2px 8px var(--shad);
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
      `}</style>
      <button
        className="theme-toggle"
        onClick={handleToggle}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={isDark}
        style={cssVars as React.CSSProperties}
      >
        <div className="toggle-halo" />
        <div className="toggle-thumb" style={{ left: tx, transform: `rotate(${rot}deg)` }}>
          {isDark ? <Moon sa={sa} /> : <Sun rs={rs} />}
        </div>
      </button>
    </>
  );
}
