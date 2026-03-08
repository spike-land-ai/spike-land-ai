"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useInViewProgress } from "../ui/useInViewProgress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceBox {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  // Grid position in the "before" state (as percentage offsets)
  gridCol: number; // 0-4 index in a 5-item layout
}

interface ConnectionLine {
  from: string;
  to: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SERVICES: ServiceBox[] = [
  {
    id: "prisma",
    label: "Prisma",
    sublabel: "Schema + Migrations",
    color: "#a855f7",
    bgColor: "rgba(168,85,247,0.1)",
    borderColor: "rgba(168,85,247,0.4)",
    icon: "◈",
    gridCol: 0,
  },
  {
    id: "express",
    label: "Express",
    sublabel: "REST API Layer",
    color: "#22c55e",
    bgColor: "rgba(34,197,94,0.1)",
    borderColor: "rgba(34,197,94,0.4)",
    icon: "⬡",
    gridCol: 1,
  },
  {
    id: "nextauth",
    label: "NextAuth",
    sublabel: "Auth & Sessions",
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.1)",
    borderColor: "rgba(59,130,246,0.4)",
    icon: "⬢",
    gridCol: 2,
  },
  {
    id: "redis",
    label: "Redis",
    sublabel: "Cache + Pub/Sub",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.4)",
    icon: "◆",
    gridCol: 3,
  },
  {
    id: "sqs",
    label: "SQS",
    sublabel: "Message Queue",
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.1)",
    borderColor: "rgba(249,115,22,0.4)",
    icon: "▣",
    gridCol: 4,
  },
];

const CONNECTIONS: ConnectionLine[] = [
  { from: "prisma", to: "express" },
  { from: "express", to: "nextauth" },
  { from: "express", to: "redis" },
  { from: "redis", to: "sqs" },
  { from: "nextauth", to: "redis" },
  { from: "prisma", to: "redis" },
];

const SPACETIME_FEATURES = [
  { label: "Tables", value: "= Schema", color: "#06b6d4" },
  { label: "Reducers", value: "= API", color: "#06b6d4" },
  { label: "ctx.sender", value: "= Auth", color: "#67e8f9" },
  { label: "Subscriptions", value: "= Real-time", color: "#67e8f9" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the grid x-center (0-1) for a service by gridCol index. */
function serviceX(col: number): number {
  // 5 columns evenly spaced within [0.08, 0.92]
  return 0.08 + col * ((0.92 - 0.08) / 4);
}

/** Returns the grid y-center, alternating top/bottom row for readability. */
function serviceY(col: number): number {
  return col % 2 === 0 ? 0.3 : 0.65;
}

// ─── SVG Connection Lines ─────────────────────────────────────────────────────

interface ConnectionLinesProps {
  progress: number; // 0-1 overall
  width: number;
  height: number;
}

function ConnectionLines({ progress, width, height }: ConnectionLinesProps) {
  // Lines visible from 0 to 0.6, fading out as boxes merge
  const lineOpacity = Math.max(0, 1 - (progress - 0.15) / 0.35);
  if (lineOpacity <= 0) return null;

  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        pointerEvents: "none",
        opacity: lineOpacity,
      }}
    >
      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="hsl(var(--muted-foreground) / 0.4)" />
        </marker>
      </defs>
      {CONNECTIONS.map(({ from, to }) => {
        const fromService = SERVICES.find((s) => s.id === from);
        const toService = SERVICES.find((s) => s.id === to);
        if (!fromService || !toService) return null;

        const x1 = serviceX(fromService.gridCol) * width;
        const y1 = serviceY(fromService.gridCol) * height;
        const x2 = serviceX(toService.gridCol) * width;
        const y2 = serviceY(toService.gridCol) * height;

        // Midpoint for a gentle curve
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - 14;

        return (
          <path
            key={`${from}-${to}`}
            d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.25)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

// ─── Individual Service Box ───────────────────────────────────────────────────

interface ServiceBoxCardProps {
  service: ServiceBox;
  progress: number;
  containerWidth: number;
  containerHeight: number;
}

function ServiceBoxCard({
  service,
  progress,
  containerWidth,
  containerHeight,
}: ServiceBoxCardProps) {
  const BOX_W = 96;
  const BOX_H = 60;

  // Phase 1 (0-0.3): fully visible at grid position
  // Phase 2 (0.3-0.7): move toward center + fade
  // Phase 3 (0.7+): fully gone
  const mergeProgress = Math.max(0, Math.min(1, (progress - 0.3) / 0.4));

  const gridCx = serviceX(service.gridCol) * containerWidth;
  const gridCy = serviceY(service.gridCol) * containerHeight;
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  const cx = gridCx + (centerX - gridCx) * mergeProgress;
  const cy = gridCy + (centerY - gridCy) * mergeProgress;

  const x = cx - BOX_W / 2;
  const y = cy - BOX_H / 2;

  const opacity = Math.max(0, 1 - mergeProgress * 1.4);
  const scale = 1 - mergeProgress * 0.35;

  // Stagger appearance per column
  const appearDelay = service.gridCol * 0.06;
  const appearProgress = Math.max(0, Math.min(1, (progress - appearDelay) / 0.25));

  return (
    <motion.div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: BOX_W,
        height: BOX_H,
        opacity: opacity * appearProgress,
        scale,
        transformOrigin: "center center",
      }}
      transition={{ type: "tween", ease: "easeInOut", duration: 0.05 }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: service.bgColor,
          border: `1px solid ${service.borderColor}`,
          borderRadius: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          backdropFilter: "blur(4px)",
          boxShadow: `0 4px 16px ${service.color}20`,
        }}
      >
        <span style={{ fontSize: 18, color: service.color, lineHeight: 1 }}>{service.icon}</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: service.color,
            fontFamily: "JetBrains Mono, monospace",
            letterSpacing: "0.06em",
          }}
        >
          {service.label}
        </span>
        <span
          style={{
            fontSize: 8.5,
            color: "hsl(var(--muted-foreground) / 0.7)",
            fontFamily: "JetBrains Mono, monospace",
            textAlign: "center",
            padding: "0 4px",
          }}
        >
          {service.sublabel}
        </span>
      </div>
    </motion.div>
  );
}

// ─── SpacetimeDB Final Box ────────────────────────────────────────────────────

interface SpacetimeBoxProps {
  progress: number;
}

function SpacetimeBox({ progress }: SpacetimeBoxProps) {
  // Appears when merge is nearly complete (progress 0.65+)
  const revealProgress = Math.max(0, Math.min(1, (progress - 0.65) / 0.35));
  const glowIntensity = revealProgress;

  return (
    <motion.div
      style={{
        opacity: revealProgress,
        scale: 0.7 + revealProgress * 0.3,
        transformOrigin: "center center",
      }}
      transition={{ type: "tween", ease: "easeOut", duration: 0.05 }}
      className="absolute inset-x-8 inset-y-4 flex items-center justify-center"
    >
      <div
        style={{
          position: "relative",
          background: "rgba(6,182,212,0.06)",
          border: `2px solid rgba(6,182,212,${0.3 + glowIntensity * 0.5})`,
          borderRadius: 18,
          padding: "18px 28px",
          width: "100%",
          maxWidth: 380,
          boxShadow: `
            0 0 ${30 * glowIntensity}px rgba(6,182,212,${0.25 * glowIntensity}),
            0 0 ${60 * glowIntensity}px rgba(6,182,212,${0.1 * glowIntensity}),
            inset 0 1px 0 rgba(6,182,212,${0.2 * glowIntensity})
          `,
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Animated corner accents */}
        {[
          { top: -2, left: -2, borderTop: 2, borderLeft: 2 },
          { top: -2, right: -2, borderTop: 2, borderRight: 2 },
          { bottom: -2, left: -2, borderBottom: 2, borderLeft: 2 },
          { bottom: -2, right: -2, borderBottom: 2, borderRight: 2 },
        ].map((pos, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 14,
              height: 14,
              borderColor: `rgba(6,182,212,${0.7 * glowIntensity})`,
              borderStyle: "solid",
              borderWidth: 0,
              ...Object.fromEntries(
                Object.entries(pos)
                  .filter(([k]) => k.startsWith("border"))
                  .map(([k, v]) => [k + "Width", `${v}px`]),
              ),
              ...Object.fromEntries(Object.entries(pos).filter(([k]) => !k.startsWith("border"))),
            }}
          />
        ))}

        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div
            style={{
              fontSize: 11,
              fontFamily: "JetBrains Mono, monospace",
              color: "rgba(6,182,212,0.6)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            replaces all of the above
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: "#06b6d4",
              fontFamily: "Inter, sans-serif",
              letterSpacing: "-0.02em",
              textShadow: `0 0 ${20 * glowIntensity}px rgba(6,182,212,0.6)`,
            }}
          >
            SpacetimeDB
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px 12px",
          }}
        >
          {SPACETIME_FEATURES.map(({ label, value, color }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 5,
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  textShadow: `0 0 8px ${color}80`,
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "hsl(var(--muted-foreground) / 0.65)",
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Complexity Label ─────────────────────────────────────────────────────────

interface PhaseLabel {
  progress: number;
}

function PhaseLabel({ progress }: PhaseLabel) {
  const showBefore = progress < 0.5;
  const showAfter = progress >= 0.5;

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 0,
        right: 0,
        textAlign: "center",
      }}
    >
      <AnimatePresence mode="wait">
        {showBefore && (
          <motion.div
            key="before"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 12px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 20,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(239,68,68,0.8)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.8)",
              }}
            />
            5 services · 6 integration points
          </motion.div>
        )}
        {showAfter && (
          <motion.div
            key="after"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25 }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "3px 12px",
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.3)",
              borderRadius: 20,
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(6,182,212,0.9)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "rgba(6,182,212,0.9)",
                boxShadow: "0 0 8px rgba(6,182,212,1)",
              }}
            />
            1 database · everything included
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function StackCollapseDemo() {
  const { ref, progress } = useInViewProgress();

  // We render the visualization on a fixed-aspect canvas via a relative container
  const CANVAS_W = 520;
  const CANVAS_H = 220;

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(6,182,212,0.07),transparent_60%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-cyan-500/5 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-muted/60 border border-border text-muted-foreground text-[10px] font-bold mb-4 tracking-[0.18em] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          ARCHITECTURE MIGRATION
        </div>
        <h3 className="text-foreground text-xl font-semibold tracking-tight">
          Five services collapse into one
        </h3>
        <p className="text-muted-foreground text-sm font-mono mt-1">
          Scroll to watch complexity dissolve
        </p>
      </div>

      {/* Canvas */}
      <div className="relative z-10 w-full" style={{ maxWidth: CANVAS_W, margin: "0 auto" }}>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: `${(CANVAS_H / CANVAS_W) * 100}%`,
          }}
        >
          <div style={{ position: "absolute", inset: 0 }}>
            <ConnectionLines progress={progress} width={CANVAS_W} height={CANVAS_H} />
            {SERVICES.map((service) => (
              <ServiceBoxCard
                key={service.id}
                service={service}
                progress={progress}
                containerWidth={CANVAS_W}
                containerHeight={CANVAS_H}
              />
            ))}
            <SpacetimeBox progress={progress} />
            <PhaseLabel progress={progress} />
          </div>
        </div>
      </div>

      {/* Caption */}
      <p className="text-center text-[11px] text-muted-foreground font-mono tracking-widest uppercase mt-10 relative z-10">
        SpacetimeDB · The database built for agents
      </p>
    </div>
  );
}
