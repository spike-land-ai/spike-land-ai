"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useInViewProgress } from "./useInViewProgress";

// ─── Types ──────────────────────────────────────────────────────────────────

type CircleConfig = {
  id: string;
  label: string;
  // Spread position (progress = 0)
  spreadCx: number;
  spreadCy: number;
  // Converged position (progress = 1)
  convergeCx: number;
  convergeCy: number;
  fill: string;
  stroke: string;
  textColor: string;
};

// ─── Circle definitions ───────────────────────────────────────────────────────
// viewBox: 0 0 400 300
// Center of the SVG is (200, 150)
// At full convergence all three circles center on (200, 150)
// At spread they form a wide triangle

const CIRCLES: CircleConfig[] = [
  {
    id: "test",
    label: "Test",
    spreadCx: 120,
    spreadCy: 80,
    convergeCx: 200,
    convergeCy: 150,
    fill: "rgba(34,197,94,0.15)",
    stroke: "rgba(34,197,94,0.6)",
    textColor: "#4ade80",
  },
  {
    id: "code",
    label: "Code",
    spreadCx: 280,
    spreadCy: 80,
    convergeCx: 200,
    convergeCy: 150,
    fill: "rgba(59,130,246,0.15)",
    stroke: "rgba(59,130,246,0.6)",
    textColor: "#60a5fa",
  },
  {
    id: "name",
    label: "Name",
    spreadCx: 200,
    spreadCy: 215,
    convergeCx: 200,
    convergeCy: 150,
    fill: "rgba(168,85,247,0.15)",
    stroke: "rgba(168,85,247,0.6)",
    textColor: "#c084fc",
  },
];

const CIRCLE_R = 72;

// ─── Math helpers ─────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Map scroll progress → convergence factor (0 = spread, 1 = converged)
function convergeT(progress: number): number {
  const raw = (progress - 0.2) / 0.5; // 0.2–0.7 window
  return easeInOut(Math.max(0, Math.min(1, raw)));
}

// Center glow opacity when fully converged
function glowOpacity(progress: number): number {
  return Math.max(0, Math.min(1, (progress - 0.7) / 0.2));
}

// ─── Animated center label ───────────────────────────────────────────────────

type CenterLabelProps = {
  glowOp: number;
};

function CenterLabel({ glowOp }: CenterLabelProps) {
  if (glowOp <= 0) return null;

  return (
    <g opacity={glowOp}>
      {/* Outer glow ring */}
      <circle
        cx={200}
        cy={150}
        r={28}
        fill="rgba(6,182,212,0.12)"
        stroke="rgba(6,182,212,0.4)"
        strokeWidth={1}
      />
      {/* Inner core */}
      <circle cx={200} cy={150} r={16} fill="rgba(6,182,212,0.3)" />
      {/* Label */}
      <text
        x={200}
        y={146}
        textAnchor="middle"
        fill="#22d3ee"
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        letterSpacing={1}
      >
        MCP
      </text>
      <text
        x={200}
        y={158}
        textAnchor="middle"
        fill="#22d3ee"
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        letterSpacing={1}
      >
        TOOL
      </text>
    </g>
  );
}

// ─── VennSvg ─────────────────────────────────────────────────────────────────

type VennSvgProps = {
  progress: number;
  reducedMotion: boolean;
};

function VennSvg({ progress, reducedMotion }: VennSvgProps) {
  const ct = reducedMotion ? (progress > 0.5 ? 1 : 0) : convergeT(progress);
  const glowOp = glowOpacity(progress);
  const dotPatternId = "venn-dots";

  // Compute circle positions
  const circles = CIRCLES.map((c) => ({
    ...c,
    cx: lerp(c.spreadCx, c.convergeCx, ct),
    cy: lerp(c.spreadCy, c.convergeCy, ct),
  }));

  // Label positions: when spread, label floats near circle center.
  // When converged, labels need to move outward so they don't stack.
  // We keep the original spread positions for labels and fade them with convergence.
  const labelOffsets = [
    { dx: -20, dy: -16 }, // test — top left
    { dx: 20, dy: -16 }, // code — top right
    { dx: 0, dy: 22 }, // name — bottom center
  ];

  const labelOpacity = Math.max(0, 1 - ct * 1.5);

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      <defs>
        <pattern id={dotPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.8" fill="hsl(var(--foreground) / 0.05)" />
        </pattern>
        <filter id="venn-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="venn-strong-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="12" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="400" height="300" fill="hsl(var(--card))" />
      <rect width="400" height="300" fill={`url(#${dotPatternId})`} />

      {/* Ambient glow at center when converged */}
      {glowOp > 0 && (
        <circle
          cx={200}
          cy={150}
          r={80}
          fill="rgba(6,182,212,0.04)"
          opacity={glowOp}
          filter="url(#venn-strong-glow)"
        />
      )}

      {/* Circles — rendered back-to-front for correct overlap */}
      {circles.map((c, i) => {
        const offset = labelOffsets[i];
        return (
          <g key={c.id}>
            <circle
              cx={c.cx}
              cy={c.cy}
              r={CIRCLE_R}
              fill={c.fill}
              stroke={c.stroke}
              strokeWidth={1.5}
            />
            {/* Floating label, fades as circles converge */}
            <g opacity={labelOpacity}>
              <text
                x={c.cx + (offset?.dx ?? 0)}
                y={c.cy + (offset?.dy ?? 0)}
                textAnchor="middle"
                fill={c.textColor}
                fontSize={13}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
                letterSpacing={0.5}
              >
                {c.label}
              </text>
            </g>
          </g>
        );
      })}

      {/* Center intersection label — appears when fully converged */}
      <CenterLabel glowOp={glowOp} />

      {/* Progress bar */}
      <rect x={20} y={290} width={360} height={2} rx={1} fill="hsl(var(--muted) / 0.5)" />
      <rect x={20} y={290} width={360 * progress} height={2} rx={1} fill="rgba(6,182,212,0.6)" />
    </svg>
  );
}

// ─── TestCodeNameVenn ─────────────────────────────────────────────────────────

export function TestCodeNameVenn() {
  const { ref, progress } = useInViewProgress();
  const prefersReducedMotion = useReducedMotion() ?? false;

  const isConverged = progress >= 0.7;
  const isConverging = progress >= 0.2 && progress < 0.7;

  const phaseLabel = isConverged
    ? "A good MCP tool is its own test, code, and name"
    : isConverging
      ? "Three concerns collapsing into one..."
      : "Scroll to see three concepts converge";

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Ambient glows */}
      <div className="absolute top-0 left-0 w-48 h-48 bg-green-500/6 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/6 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-purple-500/6 blur-3xl pointer-events-none rounded-full" />

      {/* Header */}
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold mb-4 tracking-[0.2em] font-mono">
          <span
            className={`w-1.5 h-1.5 rounded-full bg-cyan-400 ${isConverged ? "animate-pulse" : ""}`}
          />
          CONVERGENCE DIAGRAM
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Test · Code · Name</h3>
        <p className="text-sm text-muted-foreground font-mono">
          Three properties that collapse into one when you design for MCP
        </p>
      </div>

      {/* Venn SVG */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-2xl shadow-cyan-900/10 bg-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <VennSvg progress={progress} reducedMotion={prefersReducedMotion} />
      </motion.div>

      {/* Circle legend */}
      <div className="relative z-10 mt-6 flex flex-wrap justify-center gap-6">
        {CIRCLES.map((c) => (
          <div key={c.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full border"
              style={{ background: c.fill, borderColor: c.stroke }}
            />
            <span className="text-[11px] font-mono" style={{ color: c.textColor }}>
              {c.label}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500/30 border border-cyan-500/60" />
          <span className="text-[11px] font-mono text-cyan-400">MCP Tool</span>
        </div>
      </div>

      {/* Caption */}
      <p className="relative z-10 text-[10px] text-muted-foreground font-mono tracking-widest uppercase text-center mt-6">
        {phaseLabel}
      </p>
    </div>
  );
}
