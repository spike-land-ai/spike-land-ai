"use client";

import { motion } from "framer-motion";
import { useInViewProgress } from "../ui/useInViewProgress";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OldService {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

interface NewTable {
  id: string;
  label: string;
  sublabel: string;
  color: string;
}

interface NetworkArrow {
  fromY: number; // percentage 0-1 of panel height
  toY: number;
  label: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const OLD_SERVICES: OldService[] = [
  {
    id: "redis",
    label: "Redis Pub/Sub",
    sublabel: "Messaging",
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)",
    icon: "◆",
  },
  {
    id: "sqs",
    label: "SQS",
    sublabel: "Task queue",
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.3)",
    icon: "▣",
  },
  {
    id: "postgres",
    label: "PostgreSQL + API",
    sublabel: "Tool registry",
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.08)",
    borderColor: "rgba(59,130,246,0.3)",
    icon: "⬢",
  },
  {
    id: "health",
    label: "Health checks",
    sublabel: "Presence",
    color: "#a855f7",
    bgColor: "rgba(168,85,247,0.08)",
    borderColor: "rgba(168,85,247,0.3)",
    icon: "◈",
  },
];

const NETWORK_ARROWS: NetworkArrow[] = [
  { fromY: 0.2, toY: 0.42, label: "enqueue" },
  { fromY: 0.42, toY: 0.63, label: "lookup" },
  { fromY: 0.63, toY: 0.82, label: "ping" },
];

const NEW_TABLES: NewTable[] = [
  { id: "msg", label: "AgentMessage", sublabel: "messaging", color: "#06b6d4" },
  { id: "task", label: "McpTask", sublabel: "task queue", color: "#22d3ee" },
  {
    id: "tool",
    label: "RegisteredTool",
    sublabel: "tool registry",
    color: "#67e8f9",
  },
  { id: "agent", label: "Agent", sublabel: "presence", color: "#a5f3fc" },
];

// ─── Old Way Panel ────────────────────────────────────────────────────────────

interface OldWayPanelProps {
  opacity: number;
}

function OldWayPanel({ opacity }: OldWayPanelProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        opacity,
        transition: "opacity 0.4s ease",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        position: "relative",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "8px 14px",
          background: "rgba(239,68,68,0.06)",
          borderBottom: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "12px 12px 0 0",
          border: "1px solid rgba(239,68,68,0.2)",
          marginBottom: 0,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            color: "rgba(239,68,68,0.8)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          Old Way
        </span>
        <span
          style={{
            fontSize: 8,
            fontFamily: "JetBrains Mono, monospace",
            color: "hsl(var(--muted-foreground) / 0.4)",
            marginLeft: 8,
          }}
        >
          4 separate services
        </span>
      </div>

      {/* Services with network arrows between them */}
      <div
        style={{
          position: "relative",
          border: "1px solid rgba(239,68,68,0.15)",
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: "8px 8px 8px 8px",
          background: "rgba(239,68,68,0.02)",
          display: "flex",
          gap: 6,
        }}
      >
        {/* Service boxes column */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {OLD_SERVICES.map((svc) => (
            <div
              key={svc.id}
              style={{
                background: svc.bgColor,
                border: `1px solid ${svc.borderColor}`,
                borderRadius: 8,
                padding: "7px 10px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  color: svc.color,
                  width: 20,
                  textAlign: "center",
                  flexShrink: 0,
                }}
              >
                {svc.icon}
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: svc.color,
                    fontFamily: "JetBrains Mono, monospace",
                    lineHeight: 1.2,
                  }}
                >
                  {svc.label}
                </div>
                <div
                  style={{
                    fontSize: 8.5,
                    color: "hsl(var(--muted-foreground) / 0.7)",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {svc.sublabel}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Network arrows — vertical connector column */}
        <div
          style={{
            width: 58,
            flexShrink: 0,
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-around",
            paddingTop: 22,
            paddingBottom: 8,
          }}
        >
          {NETWORK_ARROWS.map((arrow, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                flex: 1,
                justifyContent: "center",
              }}
            >
              {/* Arrow line */}
              <svg width="42" height="28" viewBox="0 0 42 28" style={{ overflow: "visible" }}>
                <defs>
                  <marker
                    id={`arr-${i}`}
                    markerWidth="5"
                    markerHeight="4"
                    refX="5"
                    refY="2"
                    orient="auto"
                  >
                    <polygon points="0 0, 5 2, 0 4" fill="hsl(var(--muted-foreground) / 0.4)" />
                  </marker>
                </defs>
                <path
                  d="M 21 2 L 21 20"
                  stroke="hsl(var(--muted-foreground) / 0.3)"
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  markerEnd={`url(#arr-${i})`}
                  fill="none"
                />
              </svg>
              <span
                style={{
                  fontSize: 7.5,
                  fontFamily: "JetBrains Mono, monospace",
                  color: "hsl(var(--muted-foreground) / 0.5)",
                  letterSpacing: "0.06em",
                  textAlign: "center",
                }}
              >
                {arrow.label}
              </span>
            </div>
          ))}
          {/* Network hop count badge */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 4,
              padding: "2px 6px",
              fontSize: 7.5,
              fontFamily: "JetBrains Mono, monospace",
              color: "rgba(239,68,68,0.7)",
              whiteSpace: "nowrap",
            }}
          >
            3 net hops
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SpacetimeDB Panel ────────────────────────────────────────────────────────

interface SpacetimePanelProps {
  opacity: number;
  glowLevel: number; // 0-1
}

function SpacetimePanel({ opacity, glowLevel }: SpacetimePanelProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        opacity,
        transition: "opacity 0.4s ease",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: "8px 14px",
          background: `rgba(6,182,212,${0.04 + glowLevel * 0.08})`,
          borderBottom: `1px solid rgba(6,182,212,${0.15 + glowLevel * 0.2})`,
          borderRadius: "12px 12px 0 0",
          border: `1px solid rgba(6,182,212,${0.2 + glowLevel * 0.2})`,
          marginBottom: 0,
          boxShadow: `0 0 ${20 * glowLevel}px rgba(6,182,212,${0.1 * glowLevel})`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontFamily: "JetBrains Mono, monospace",
            fontWeight: 700,
            color: `rgba(6,182,212,${0.6 + glowLevel * 0.3})`,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            textShadow: glowLevel > 0.5 ? `0 0 8px rgba(6,182,212,0.6)` : "none",
          }}
        >
          SpacetimeDB
        </span>
        <span
          style={{
            fontSize: 8,
            fontFamily: "JetBrains Mono, monospace",
            color: "hsl(var(--muted-foreground) / 0.4)",
            marginLeft: 8,
          }}
        >
          1 database
        </span>
      </div>

      {/* Tables container — all inside one box */}
      <div
        style={{
          border: `1px solid rgba(6,182,212,${0.15 + glowLevel * 0.25})`,
          borderTop: "none",
          borderRadius: "0 0 12px 12px",
          padding: "8px",
          background: `rgba(6,182,212,${0.02 + glowLevel * 0.04})`,
          display: "flex",
          flexDirection: "column",
          gap: 5,
          position: "relative",
          flex: 1,
          boxShadow: `inset 0 0 ${24 * glowLevel}px rgba(6,182,212,${0.06 * glowLevel})`,
        }}
      >
        {/* Internal connection indicator — simple vertical line at left */}
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 18,
            bottom: 18,
            width: 1,
            background: `linear-gradient(to bottom, transparent, rgba(6,182,212,${
              0.3 * glowLevel
            }), transparent)`,
          }}
        />

        {NEW_TABLES.map((table, i) => (
          <div
            key={table.id}
            style={{
              background: `rgba(6,182,212,${0.05 + glowLevel * 0.05})`,
              border: `1px solid rgba(6,182,212,${0.15 + glowLevel * 0.2})`,
              borderRadius: 7,
              padding: "6px 10px 6px 28px",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            {/* Internal dot */}
            <div
              style={{
                position: "absolute",
                left: 18,
                top: "50%",
                transform: "translate(-50%, -50%)",
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: table.color,
                boxShadow: glowLevel > 0.4 ? `0 0 6px ${table.color}` : "none",
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: table.color,
                  fontFamily: "JetBrains Mono, monospace",
                  lineHeight: 1.2,
                  textShadow: glowLevel > 0.6 ? `0 0 8px ${table.color}80` : "none",
                }}
              >
                {table.label}
              </div>
              <div
                style={{
                  fontSize: 8.5,
                  color: "hsl(var(--muted-foreground) / 0.7)",
                  fontFamily: "JetBrains Mono, monospace",
                }}
              >
                {table.sublabel}
              </div>
            </div>
            {/* Table badge */}
            <span
              style={{
                fontSize: 7,
                fontFamily: "JetBrains Mono, monospace",
                color: `rgba(6,182,212,${0.4 + glowLevel * 0.35})`,
                background: `rgba(6,182,212,${0.06 + glowLevel * 0.06})`,
                border: `1px solid rgba(6,182,212,${0.15 + glowLevel * 0.15})`,
                borderRadius: 3,
                padding: "1px 5px",
                flexShrink: 0,
                letterSpacing: "0.08em",
              }}
            >
              TABLE {i + 1}
            </span>
          </div>
        ))}

        {/* Zero hops badge */}
        <div
          style={{
            textAlign: "center",
            marginTop: 2,
          }}
        >
          <span
            style={{
              fontSize: 7.5,
              fontFamily: "JetBrains Mono, monospace",
              color: `rgba(6,182,212,${0.5 + glowLevel * 0.4})`,
              background: `rgba(6,182,212,${0.06 + glowLevel * 0.06})`,
              border: `1px solid rgba(6,182,212,${0.15 + glowLevel * 0.2})`,
              borderRadius: 4,
              padding: "2px 8px",
              display: "inline-block",
              textShadow: glowLevel > 0.7 ? `0 0 8px rgba(6,182,212,0.6)` : "none",
            }}
          >
            0 network hops · local reads · real-time subscriptions
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Divider with VS label ────────────────────────────────────────────────────

interface VsDividerProps {
  progress: number;
}

function VsDivider({ progress }: VsDividerProps) {
  // Divider shifts slightly right as spacetime side brightens
  const shift = progress * 4; // px shift

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "0 6px",
        flexShrink: 0,
        transform: `translateX(${shift}px)`,
        transition: "transform 0.3s ease",
      }}
    >
      <div
        style={{
          width: 1,
          flex: 1,
          background:
            "linear-gradient(to bottom, transparent, rgba(148,163,184,0.2) 30%, rgba(148,163,184,0.2) 70%, transparent)",
        }}
      />
      <div
        style={{
          padding: "4px 7px",
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(148,163,184,0.15)",
          borderRadius: 6,
          fontSize: 9,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          color: "rgba(148,163,184,0.4)",
          letterSpacing: "0.1em",
        }}
      >
        VS
      </div>
      <div
        style={{
          width: 1,
          flex: 1,
          background:
            "linear-gradient(to bottom, transparent, rgba(148,163,184,0.2) 30%, rgba(148,163,184,0.2) 70%, transparent)",
        }}
      />
    </div>
  );
}

// ─── Complexity Reduction Metric ──────────────────────────────────────────────

interface MetricBarProps {
  progress: number;
}

function MetricBar({ progress }: MetricBarProps) {
  const reduceProgress = Math.max(0, Math.min(1, (progress - 0.3) / 0.7));
  // Old complexity score: 4 services × 3 hops = high
  // New: 1 database × 0 hops = minimal
  const complexityScore = Math.round(100 - reduceProgress * 75);

  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 14px",
        background: "rgba(15,23,42,0.5)",
        border: "1px solid rgba(148,163,184,0.1)",
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontFamily: "JetBrains Mono, monospace",
          color: "rgba(148,163,184,0.5)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        Ops complexity
      </span>

      <div
        style={{
          flex: 1,
          height: 5,
          background: "rgba(148,163,184,0.08)",
          borderRadius: 3,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Background full bar (red) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(239,68,68,0.15)",
          }}
        />
        {/* Progress bar shrinks as we move to SpacetimeDB */}
        <motion.div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${complexityScore}%`,
            borderRadius: 3,
            background:
              reduceProgress > 0.5
                ? `linear-gradient(90deg, rgba(239,68,68,0.6), rgba(6,182,212,0.6))`
                : "rgba(239,68,68,0.6)",
          }}
          transition={{ type: "tween", ease: "easeOut", duration: 0.1 }}
        />
      </div>

      <span
        style={{
          fontSize: 11,
          fontFamily: "JetBrains Mono, monospace",
          fontWeight: 700,
          color:
            reduceProgress > 0.5
              ? `rgba(6,182,212,${0.7 + reduceProgress * 0.3})`
              : "rgba(239,68,68,0.7)",
          width: 38,
          textAlign: "right",
          flexShrink: 0,
          transition: "color 0.3s ease",
        }}
      >
        {complexityScore}%
      </span>

      <span
        style={{
          fontSize: 8,
          fontFamily: "JetBrains Mono, monospace",
          color: "rgba(148,163,184,0.3)",
          flexShrink: 0,
        }}
      >
        {reduceProgress > 0.7 ? "collapsed" : reduceProgress > 0.3 ? "merging..." : "baseline"}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AgentCoordinationDemo() {
  const { ref, progress } = useInViewProgress();

  // Left side (old) fades out as progress advances past 0.4
  const leftOpacity = Math.max(0.25, 1 - Math.max(0, progress - 0.35) / 0.45);
  // Right side (new) brightens as progress advances
  const rightOpacity = 0.3 + Math.min(0.7, progress * 1.1);
  const glowLevel = Math.max(0, Math.min(1, (progress - 0.2) / 0.7));

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(6,182,212,0.06),transparent_55%)] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      {/* Ambient glow tracks progress */}
      <div
        className="absolute right-0 top-0 w-48 h-48 blur-3xl pointer-events-none transition-opacity duration-500"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)",
          opacity: glowLevel,
        }}
      />

      {/* Header */}
      <div className="text-center mb-10 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm bg-muted/60 border border-border text-muted-foreground text-[10px] font-bold mb-4 tracking-[0.18em] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          AGENT COORDINATION
        </div>
        <h3 className="text-foreground text-xl font-semibold tracking-tight">
          Four services become four tables
        </h3>
        <p className="text-muted-foreground text-sm font-mono mt-1">
          Scroll to see the infrastructure simplify
        </p>
      </div>

      {/* Split comparison */}
      <div className="relative z-10" style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
          <OldWayPanel opacity={leftOpacity} />
          <VsDivider progress={progress} />
          <SpacetimePanel opacity={rightOpacity} glowLevel={glowLevel} />
        </div>

        <MetricBar progress={progress} />
      </div>

      {/* Caption */}
      <p className="text-center text-[11px] text-slate-600 font-mono tracking-widest uppercase mt-10 relative z-10">
        Real-time subscriptions replace polling · no extra infra
      </p>
    </div>
  );
}
