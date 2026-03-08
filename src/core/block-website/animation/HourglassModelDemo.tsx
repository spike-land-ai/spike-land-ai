"use client";

import { motion } from "framer-motion";
import { useInViewProgress } from "../ui/useInViewProgress";

// ─── Types ──────────────────────────────────────────────────────────────────

type ZoneConfig = {
  id: string;
  label: string;
  sublabel: string;
  percentage: string;
  color: string;
  fillColor: string;
  glowColor: string;
  revealAt: number;
  isDashed?: boolean;
};

// ─── Zone definitions ────────────────────────────────────────────────────────

const ZONES: ZoneConfig[] = [
  {
    id: "e2e",
    label: "E2E Specs",
    sublabel: "Humans write these",
    percentage: "20%",
    color: "#f59e0b",
    fillColor: "rgba(245,158,11,0.25)",
    glowColor: "rgba(245,158,11,0.4)",
    revealAt: 0,
  },
  {
    id: "ui",
    label: "UI Code",
    sublabel: "Disposable, AI-generated",
    percentage: "10%",
    color: "#64748b",
    fillColor: "rgba(100,116,139,0.15)",
    glowColor: "rgba(100,116,139,0.3)",
    revealAt: 0.3,
    isDashed: true,
  },
  {
    id: "mcp",
    label: "MCP Tool Tests",
    sublabel: "Bulletproof, milliseconds",
    percentage: "70%",
    color: "#06b6d4",
    fillColor: "rgba(6,182,212,0.25)",
    glowColor: "rgba(6,182,212,0.4)",
    revealAt: 0.5,
  },
];

// ─── HourglassSvg ───────────────────────────────────────────────────────────

type HourglassSvgProps = {
  progress: number;
};

function HourglassSvg({ progress }: HourglassSvgProps) {
  // SVG coordinate system: 400 wide, 520 tall
  // Top trapezoid (E2E): full width at top, narrows to center
  // Middle rect (UI): narrow neck
  // Bottom trapezoid (MCP): wide at bottom, narrows from center

  const W = 400;
  const cx = W / 2; // 200

  // Top zone: y 20–160, wide (360) → narrow (80)
  const topWideHalf = 180;
  const topNarrowHalf = 40;
  const topY0 = 20;
  const topY1 = 165;

  // Middle zone: y 165–260, stays narrow (80)
  const midHalf = 40;
  const midY0 = 165;
  const midY1 = 260;

  // Bottom zone: y 260–400, narrow (80) → wide (360)
  const botNarrowHalf = 40;
  const botWideHalf = 180;
  const botY0 = 260;
  const botY1 = 405;

  // Zone reveal progress (clamped 0→1 within each phase window)
  const topProgress = Math.min(1, Math.max(0, progress / 0.3));
  const midProgress = Math.min(1, Math.max(0, (progress - 0.3) / 0.2));
  const botProgress = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));

  // Label opacity
  const topLabelOpacity = topProgress;
  const midLabelOpacity = midProgress;
  const botLabelOpacity = botProgress;

  // Particle / dissolve effect for middle — tiny dashes
  const dissolveOpacity = midProgress;

  // Glow pulse for bottom when fully revealed
  const botGlowIntensity = botProgress * botProgress;

  return (
    <svg
      viewBox="0 0 400 430"
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      style={{ display: "block", maxHeight: 420 }}
      aria-hidden="true"
    >
      <defs>
        <filter id="hg-glow-amber" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hg-glow-cyan" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="hg-glow-cyan-strong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="16" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Clip paths for each zone fill animation (fills from outside edge inward) */}
        <clipPath id="hg-clip-top">
          <polygon
            points={`
              ${cx - topWideHalf},${topY0}
              ${cx + topWideHalf},${topY0}
              ${cx + topNarrowHalf},${topY1}
              ${cx - topNarrowHalf},${topY1}
            `}
          />
        </clipPath>
        <clipPath id="hg-clip-mid">
          <rect x={cx - midHalf} y={midY0} width={midHalf * 2} height={midY1 - midY0} />
        </clipPath>
        <clipPath id="hg-clip-bot">
          <polygon
            points={`
              ${cx - botNarrowHalf},${botY0}
              ${cx + botNarrowHalf},${botY0}
              ${cx + botWideHalf},${botY1}
              ${cx - botWideHalf},${botY1}
            `}
          />
        </clipPath>
      </defs>

      {/* ── Background grid dots ── */}
      <pattern id="hg-dots" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.8" fill="hsl(var(--foreground) / 0.06)" />
      </pattern>
      <rect width="400" height="430" fill="transparent" />
      <rect width="400" height="430" fill="url(#hg-dots)" />

      {/* ══ TOP ZONE — E2E specs (amber) ══ */}
      {/* Outline */}
      <polygon
        points={`
          ${cx - topWideHalf},${topY0}
          ${cx + topWideHalf},${topY0}
          ${cx + topNarrowHalf},${topY1}
          ${cx - topNarrowHalf},${topY1}
        `}
        fill="none"
        stroke="rgba(245,158,11,0.35)"
        strokeWidth="1.5"
        opacity={topLabelOpacity}
      />
      {/* Fill — reveal by scaling a rect down from full height */}
      <g clipPath="url(#hg-clip-top)" opacity={topProgress}>
        <rect
          x={cx - topWideHalf - 4}
          y={topY0}
          width={topWideHalf * 2 + 8}
          height={(topY1 - topY0) * topProgress}
          fill="rgba(245,158,11,0.18)"
          filter="url(#hg-glow-amber)"
        />
      </g>
      {/* Top edge highlight */}
      <line
        x1={cx - topWideHalf}
        y1={topY0}
        x2={cx + topWideHalf}
        y2={topY0}
        stroke="#f59e0b"
        strokeWidth="2"
        opacity={topLabelOpacity}
        filter="url(#hg-glow-amber)"
      />

      {/* ══ MIDDLE ZONE — UI Code (slate, dashed = disposable) ══ */}
      {/* Dashed border signals "disposable" */}
      <rect
        x={cx - midHalf}
        y={midY0}
        width={midHalf * 2}
        height={midY1 - midY0}
        fill="none"
        stroke="rgba(100,116,139,0.5)"
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity={dissolveOpacity}
      />
      {/* Subtle fill */}
      <rect
        x={cx - midHalf + 1}
        y={midY0 + 1}
        width={midHalf * 2 - 2}
        height={(midY1 - midY0 - 2) * midProgress}
        fill="rgba(100,116,139,0.12)"
        opacity={dissolveOpacity}
      />
      {/* Dissolve particles — small scattered rects */}
      {dissolveOpacity > 0.4 &&
        [
          { x: cx - 28, y: midY0 + 20 },
          { x: cx + 14, y: midY0 + 40 },
          { x: cx - 8, y: midY0 + 60 },
          { x: cx + 22, y: midY0 + 15 },
          { x: cx - 22, y: midY0 + 72 },
          { x: cx + 4, y: midY0 + 55 },
        ].map((p, i) => (
          <rect
            key={i}
            x={p.x}
            y={p.y}
            width="4"
            height="4"
            rx="1"
            fill="#64748b"
            opacity={(dissolveOpacity - 0.4) * 1.2 * (0.4 + (i % 3) * 0.2)}
          />
        ))}

      {/* ══ BOTTOM ZONE — MCP Tool Tests (cyan) ══ */}
      {/* Outline */}
      <polygon
        points={`
          ${cx - botNarrowHalf},${botY0}
          ${cx + botNarrowHalf},${botY0}
          ${cx + botWideHalf},${botY1}
          ${cx - botWideHalf},${botY1}
        `}
        fill="none"
        stroke="rgba(6,182,212,0.45)"
        strokeWidth="1.5"
        opacity={botLabelOpacity}
        filter={botGlowIntensity > 0.6 ? "url(#hg-glow-cyan)" : undefined}
      />
      {/* Fill — reveal by scaling rect up from top of zone */}
      <g clipPath="url(#hg-clip-bot)" opacity={botProgress}>
        <rect
          x={cx - botWideHalf - 4}
          y={botY0}
          width={botWideHalf * 2 + 8}
          height={(botY1 - botY0) * botProgress}
          fill="rgba(6,182,212,0.2)"
          filter="url(#hg-glow-cyan)"
        />
      </g>
      {/* Bottom edge — cyan glow line when fully revealed */}
      <line
        x1={cx - botWideHalf}
        y1={botY1}
        x2={cx + botWideHalf}
        y2={botY1}
        stroke="#06b6d4"
        strokeWidth="2"
        opacity={botLabelOpacity}
        filter={botGlowIntensity > 0.7 ? "url(#hg-glow-cyan-strong)" : "url(#hg-glow-cyan)"}
      />

      {/* ══ PERCENTAGE LABELS (left side) ══ */}
      {/* Top — 20% */}
      <g opacity={topLabelOpacity}>
        <text
          x={cx - topWideHalf - 12}
          y={(topY0 + topY1) / 2 + 5}
          textAnchor="end"
          fill="#f59e0b"
          fontSize="22"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
        >
          20%
        </text>
      </g>

      {/* Middle — 10% */}
      <g opacity={midLabelOpacity}>
        <text
          x={cx - midHalf - 12}
          y={(midY0 + midY1) / 2 + 5}
          textAnchor="end"
          fill="hsl(var(--muted-foreground))"
          fontSize="16"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
        >
          10%
        </text>
      </g>

      {/* Bottom — 70% */}
      <g opacity={botLabelOpacity}>
        <text
          x={cx + botWideHalf + 12}
          y={(botY0 + botY1) / 2 + 5}
          textAnchor="start"
          fill="#06b6d4"
          fontSize="22"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          filter={botGlowIntensity > 0.7 ? "url(#hg-glow-cyan)" : undefined}
        >
          70%
        </text>
      </g>

      {/* ══ ZONE TEXT LABELS (center column, right of outline) ══ */}
      {/* E2E Specs label */}
      <g opacity={topLabelOpacity}>
        <text
          x={cx + topWideHalf + 14}
          y={(topY0 + topY1) / 2 - 8}
          textAnchor="start"
          fill="#f59e0b"
          fontSize="11"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing="1"
        >
          E2E SPECS
        </text>
        <text
          x={cx + topWideHalf + 14}
          y={(topY0 + topY1) / 2 + 8}
          textAnchor="start"
          fill="rgba(245,158,11,0.65)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          Humans write these
        </text>
      </g>

      {/* UI Code label */}
      <g opacity={midLabelOpacity}>
        <text
          x={cx + midHalf + 14}
          y={(midY0 + midY1) / 2 - 7}
          textAnchor="start"
          fill="hsl(var(--muted-foreground))"
          fontSize="10"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing="1"
        >
          UI CODE
        </text>
        <text
          x={cx + midHalf + 14}
          y={(midY0 + midY1) / 2 + 7}
          textAnchor="start"
          fill="hsl(var(--muted-foreground) / 0.55)"
          fontSize="8.5"
          fontFamily="JetBrains Mono, monospace"
        >
          Disposable, AI-gen
        </text>
      </g>

      {/* MCP Tool Tests label */}
      <g opacity={botLabelOpacity}>
        <text
          x={cx - botWideHalf - 14}
          y={(botY0 + botY1) / 2 - 8}
          textAnchor="end"
          fill="#06b6d4"
          fontSize="11"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing="1"
          filter={botGlowIntensity > 0.8 ? "url(#hg-glow-cyan)" : undefined}
        >
          MCP TOOL TESTS
        </text>
        <text
          x={cx - botWideHalf - 14}
          y={(botY0 + botY1) / 2 + 8}
          textAnchor="end"
          fill="rgba(6,182,212,0.65)"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
        >
          Bulletproof, milliseconds
        </text>
      </g>

      {/* ══ CENTER connector — vertical spine ══ */}
      <line
        x1={cx}
        y1={topY1}
        x2={cx}
        y2={midY0}
        stroke="hsl(var(--border) / 0.5)"
        strokeWidth="1"
        opacity={topLabelOpacity}
      />
      <line
        x1={cx}
        y1={midY1}
        x2={cx}
        y2={botY0}
        stroke="hsl(var(--border) / 0.5)"
        strokeWidth="1"
        opacity={midLabelOpacity}
      />
    </svg>
  );
}

// ─── HourglassModelDemo ──────────────────────────────────────────────────────

export function HourglassModelDemo() {
  const { ref, progress } = useInViewProgress();

  const topProgress = Math.min(1, Math.max(0, progress / 0.3));
  const midProgress = Math.min(1, Math.max(0, (progress - 0.3) / 0.2));
  const botProgress = Math.min(1, Math.max(0, (progress - 0.5) / 0.5));

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-amber-500/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-64 bg-cyan-500/10 blur-3xl pointer-events-none" />
      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800/0 via-slate-800/0 to-slate-800/0 group-hover:from-cyan-950/10 group-hover:to-amber-950/10 transition-all duration-700 pointer-events-none rounded-[2.5rem]" />

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-bold mb-4 tracking-[0.2em] font-mono shadow-[0_0_15px_rgba(34,211,238,0.12)]">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          HOURGLASS TESTING MODEL
        </div>
        <p className="text-sm font-light text-muted-foreground max-w-md mx-auto leading-relaxed">
          Wide at both ends — narrow only where it doesn&apos;t matter. Scroll to reveal the layers.
        </p>
      </div>

      {/* SVG diagram */}
      <div className="relative z-10 max-w-lg mx-auto">
        <HourglassSvg progress={progress} />
      </div>

      {/* Legend cards — appear sequentially */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
        {ZONES.map((zone) => {
          const zoneProgress =
            zone.id === "e2e" ? topProgress : zone.id === "ui" ? midProgress : botProgress;

          return (
            <motion.div
              key={zone.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{
                opacity: zoneProgress,
                y: zoneProgress < 0.1 ? 12 : 0,
              }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              style={{
                border: `1px solid ${zone.color}${zone.isDashed ? "30" : "35"}`,
                background: zone.fillColor,
                borderStyle: zone.isDashed ? "dashed" : "solid",
              }}
              className="rounded-xl p-4 backdrop-blur-sm"
            >
              <div
                className="font-mono text-xs font-bold tracking-[0.15em] uppercase mb-1"
                style={{ color: zone.color }}
              >
                {zone.percentage} — {zone.label}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">{zone.sublabel}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Caption */}
      <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase text-center mt-8 relative z-10">
        {progress < 0.15
          ? "Scroll to reveal the model"
          : progress < 0.4
            ? "Top: human intent as E2E specs"
            : progress < 0.6
              ? "Middle: disposable AI-generated UI"
              : "Bottom: fast, durable MCP tool tests"}
      </p>
    </div>
  );
}
