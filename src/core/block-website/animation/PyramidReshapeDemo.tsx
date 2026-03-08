"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useInViewProgress } from "../ui/useInViewProgress";

// ─── Types ──────────────────────────────────────────────────────────────────

type LayerConfig = {
  id: string;
  classicLabel: string;
  classicSub: string;
  modernLabel: string;
  modernSub: string;
  fill: string;
  stroke: string;
  textColor: string;
};

// ─── Layer definitions ───────────────────────────────────────────────────────

const LAYERS: LayerConfig[] = [
  {
    id: "e2e",
    classicLabel: "E2E Tests",
    classicSub: "slow, few",
    modernLabel: "E2E Specs",
    modernSub: "smoke tests",
    fill: "rgba(245,158,11,0.18)",
    stroke: "rgba(245,158,11,0.7)",
    textColor: "#fbbf24",
  },
  {
    id: "integration",
    classicLabel: "Integration Tests",
    classicSub: "medium speed",
    modernLabel: "UI Code",
    modernSub: "disposable",
    fill: "rgba(100,116,139,0.18)",
    stroke: "rgba(100,116,139,0.55)",
    textColor: "#94a3b8",
  },
  {
    id: "unit",
    classicLabel: "Unit Tests",
    classicSub: "fast, many",
    modernLabel: "MCP Tool Tests",
    modernSub: "fast, many",
    fill: "rgba(6,182,212,0.18)",
    stroke: "rgba(6,182,212,0.7)",
    textColor: "#22d3ee",
  },
];

// ─── SVG geometry helpers ────────────────────────────────────────────────────

// viewBox: 0 0 400 320
// The pyramid and hourglass shapes are defined as [x1, y1, x2, y2] trapezoids
// for each layer. We interpolate between them based on progress.

type Trapezoid = {
  // Points: top-left, top-right, bottom-right, bottom-left (clockwise)
  tlx: number;
  trx: number;
  topY: number;
  blx: number;
  brx: number;
  botY: number;
};

// Classic pyramid (wide at bottom, narrow at top)
const PYRAMID: Trapezoid[] = [
  // E2E — top band (narrowest)
  { tlx: 155, trx: 245, topY: 30, blx: 130, brx: 270, botY: 90 },
  // Integration — middle band
  { tlx: 130, trx: 270, topY: 92, blx: 90, brx: 310, botY: 165 },
  // Unit — bottom band (widest)
  { tlx: 90, trx: 310, topY: 167, blx: 40, brx: 360, botY: 255 },
];

// Hourglass (wide at top & bottom, pinched middle)
const HOURGLASS: Trapezoid[] = [
  // E2E — top band (wide again, thinned vertically)
  { tlx: 55, trx: 345, topY: 30, blx: 100, brx: 300, botY: 78 },
  // UI code — pinched middle (very thin)
  { tlx: 100, trx: 300, topY: 80, blx: 150, brx: 250, botY: 115 },
  // MCP Tool Tests — bottom band (very wide)
  { tlx: 150, trx: 250, topY: 117, blx: 40, brx: 360, botY: 255 },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolateTrap(a: Trapezoid, b: Trapezoid, t: number): Trapezoid {
  return {
    tlx: lerp(a.tlx, b.tlx, t),
    trx: lerp(a.trx, b.trx, t),
    topY: lerp(a.topY, b.topY, t),
    blx: lerp(a.blx, b.blx, t),
    brx: lerp(a.brx, b.brx, t),
    botY: lerp(a.botY, b.botY, t),
  };
}

function trapPath(t: Trapezoid): string {
  return `M ${t.tlx} ${t.topY} L ${t.trx} ${t.topY} L ${t.brx} ${t.botY} L ${t.blx} ${t.botY} Z`;
}

// ─── Easing ──────────────────────────────────────────────────────────────────

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Map raw progress (0–1) → morph t (0–1) for the shape transition
function morphT(progress: number): number {
  // Morph happens in the 0.3–0.7 window
  const raw = (progress - 0.3) / 0.4;
  return easeInOut(Math.max(0, Math.min(1, raw)));
}

// Label crossfade: classic labels fade out, modern labels fade in
function classicOpacity(progress: number): number {
  return Math.max(0, 1 - progress / 0.35);
}

function modernOpacity(progress: number): number {
  return Math.max(0, (progress - 0.65) / 0.25);
}

// ─── Layer shape component ───────────────────────────────────────────────────

type LayerShapeProps = {
  layer: LayerConfig;
  index: number;
  morphProgress: number;
  classicLabelOpacity: number;
  modernLabelOpacity: number;
  reducedMotion: boolean;
};

function LayerShape({
  layer,
  index,
  morphProgress,
  classicLabelOpacity,
  modernLabelOpacity,
  reducedMotion,
}: LayerShapeProps) {
  const pyramid = PYRAMID[index];
  const hourglass = HOURGLASS[index];
  if (!pyramid || !hourglass) return null;

  const trap = reducedMotion
    ? morphProgress > 0.5
      ? hourglass
      : pyramid
    : interpolateTrap(pyramid, hourglass, morphProgress);

  const d = trapPath(trap);
  const centerX = 200;
  const centerY = (trap.topY + trap.botY) / 2;

  return (
    <g>
      <path d={d} fill={layer.fill} stroke={layer.stroke} strokeWidth={1.5} />

      {/* Classic labels */}
      <g opacity={classicLabelOpacity}>
        <text
          x={centerX}
          y={centerY - 7}
          textAnchor="middle"
          fill={layer.textColor}
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing={0.5}
        >
          {layer.classicLabel}
        </text>
        <text
          x={centerX}
          y={centerY + 9}
          textAnchor="middle"
          fill={layer.textColor}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
          opacity={0.7}
        >
          {layer.classicSub}
        </text>
      </g>

      {/* Modern labels */}
      <g opacity={modernLabelOpacity}>
        <text
          x={centerX}
          y={centerY - 7}
          textAnchor="middle"
          fill={layer.textColor}
          fontSize={11}
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing={0.5}
        >
          {layer.modernLabel}
        </text>
        <text
          x={centerX}
          y={centerY + 9}
          textAnchor="middle"
          fill={layer.textColor}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
          opacity={0.7}
        >
          {layer.modernSub}
        </text>
      </g>
    </g>
  );
}

// ─── Stage label strip ───────────────────────────────────────────────────────

type StageLabelProps = {
  progress: number;
};

function StageLabel({ progress }: StageLabelProps) {
  const isClassic = progress < 0.3;
  const isMorphing = progress >= 0.3 && progress < 0.7;
  const isModern = progress >= 0.7;

  const label = isClassic
    ? "Classic Testing Pyramid"
    : isMorphing
      ? "Reshaping..."
      : "MCP Hourglass";

  const color = isModern ? "#22d3ee" : isMorphing ? "hsl(var(--muted-foreground))" : "#fbbf24";

  return (
    <g>
      <rect
        x={100}
        y={268}
        width={200}
        height={22}
        rx={4}
        fill="hsl(var(--muted) / 0.9)"
        stroke={color}
        strokeWidth={0.75}
        strokeOpacity={0.5}
      />
      <text
        x={200}
        y={283}
        textAnchor="middle"
        fill={color}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        letterSpacing={1.5}
      >
        {label.toUpperCase()}
      </text>
    </g>
  );
}

// ─── PyramidReshapeSvg ───────────────────────────────────────────────────────

type PyramidReshapeSvgProps = {
  progress: number;
  reducedMotion: boolean;
};

function PyramidReshapeSvg({ progress, reducedMotion }: PyramidReshapeSvgProps) {
  const mt = morphT(progress);
  const classicOp = classicOpacity(progress);
  const modernOp = modernOpacity(progress);

  const dotPatternId = "pyramid-dots";
  const glowId = "pyramid-glow";

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      <defs>
        <pattern id={dotPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="10" cy="10" r="0.8" fill="hsl(var(--foreground) / 0.06)" />
        </pattern>
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect width="400" height="300" fill="hsl(var(--card))" />
      <rect width="400" height="300" fill={`url(#${dotPatternId})`} />

      {/* Glow blobs */}
      <ellipse cx="200" cy="280" rx="120" ry="20" fill="rgba(6,182,212,0.04)" />
      <ellipse cx="200" cy="50" rx="80" ry="15" fill="rgba(245,158,11,0.04)" />

      {LAYERS.map((layer, i) => (
        <LayerShape
          key={layer.id}
          layer={layer}
          index={i}
          morphProgress={mt}
          classicLabelOpacity={classicOp}
          modernLabelOpacity={modernOp}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* Separator lines between layers, fade during morph */}
      <line x1={40} y1={255} x2={360} y2={255} stroke="rgba(30,41,59,0.6)" strokeWidth={1} />

      <StageLabel progress={progress} />

      {/* Progress bar at the very bottom */}
      <rect x={20} y={295} width={360} height={2} rx={1} fill="rgba(30,41,59,0.5)" />
      <rect x={20} y={295} width={360 * progress} height={2} rx={1} fill="rgba(6,182,212,0.6)" />
    </svg>
  );
}

// ─── PyramidReshapeDemo ───────────────────────────────────────────────────────

export function PyramidReshapeDemo() {
  const { ref, progress } = useInViewProgress();
  const prefersReducedMotion = useReducedMotion() ?? false;

  const phaseLabel =
    progress < 0.3
      ? "Scroll to begin the transformation"
      : progress < 0.7
        ? "Watch the pyramid reshape..."
        : "The MCP hourglass — tests at every level";

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Ambient glows */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/8 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/8 blur-3xl pointer-events-none rounded-full" />

      {/* Header */}
      <div className="relative z-10 text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold mb-4 tracking-[0.2em] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          TESTING STRATEGY
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">Pyramid to Hourglass</h3>
        <p className="text-sm text-muted-foreground font-mono">
          How MCP tooling inverts the classic testing hierarchy
        </p>
      </div>

      {/* SVG visualization */}
      <motion.div
        className="relative z-10 w-full max-w-md mx-auto aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-2xl shadow-cyan-900/10 bg-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <PyramidReshapeSvg progress={progress} reducedMotion={prefersReducedMotion} />
      </motion.div>

      {/* Legend */}
      <div className="relative z-10 mt-6 flex flex-wrap justify-center gap-4">
        {LAYERS.map((layer) => (
          <div key={layer.id} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm border"
              style={{ background: layer.fill, borderColor: layer.stroke }}
            />
            <span className="text-[11px] font-mono" style={{ color: layer.textColor }}>
              {layer.modernLabel}
            </span>
          </div>
        ))}
      </div>

      {/* Caption */}
      <p className="relative z-10 text-[10px] text-muted-foreground font-mono tracking-widest uppercase text-center mt-6">
        {phaseLabel}
      </p>
    </div>
  );
}
