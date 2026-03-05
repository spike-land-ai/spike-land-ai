"use client";

import { motion } from "framer-motion";
import { useInViewProgress } from "./useInViewProgress";

// ─── Types ───────────────────────────────────────────────────────────────────

type NodeDef = {
  id: string;
  label: string;
  sublabel: string;
  x: number; // viewBox coords (0-800)
  y: number; // viewBox coords (0-480)
  isRoot?: boolean;
  activateAt: number; // progress threshold 0-1
};

type EdgeDef = {
  from: string;
  to: string;
  activateAt: number;
};

// ─── Graph data ──────────────────────────────────────────────────────────────

const NODES: NodeDef[] = [
  // Root — center-top
  {
    id: "shared",
    label: "shared",
    sublabel: "@spike-land-ai",
    x: 400,
    y: 80,
    isRoot: true,
    activateAt: 0.0,
  },
  // Tier 1 — two direct consumers spread wide
  {
    id: "code",
    label: "code",
    sublabel: "Monaco editor",
    x: 160,
    y: 220,
    activateAt: 0.45,
  },
  {
    id: "mcp-image",
    label: "mcp-image-studio",
    sublabel: "AI images",
    x: 640,
    y: 220,
    activateAt: 0.52,
  },
  // Tier 2 — downstream of code
  {
    id: "transpile",
    label: "transpile",
    sublabel: "esbuild edge",
    x: 80,
    y: 350,
    activateAt: 0.6,
  },
  {
    id: "spike-land-backend",
    label: "backend",
    sublabel: "Durable Objects",
    x: 260,
    y: 370,
    activateAt: 0.65,
  },
  // Tier 2 — independent consumers
  {
    id: "spike-land-mcp",
    label: "spike-land-mcp",
    sublabel: "MCP registry",
    x: 430,
    y: 340,
    activateAt: 0.58,
  },
  {
    id: "spike.land",
    label: "spike.land",
    sublabel: "Vite + CF Workers",
    x: 590,
    y: 370,
    activateAt: 0.7,
  },
  {
    id: "spike-app",
    label: "spike-app",
    sublabel: "Vite SPA",
    x: 720,
    y: 350,
    activateAt: 0.63,
  },
];

const EDGES: EdgeDef[] = [
  { from: "shared", to: "code", activateAt: 0.42 },
  { from: "shared", to: "mcp-image", activateAt: 0.48 },
  { from: "shared", to: "spike-land-mcp", activateAt: 0.54 },
  { from: "shared", to: "spike.land", activateAt: 0.56 },
  { from: "code", to: "transpile", activateAt: 0.58 },
  { from: "code", to: "spike-land-backend", activateAt: 0.62 },
  { from: "mcp-image", to: "spike-app", activateAt: 0.6 },
  { from: "spike-land-mcp", to: "spike.land", activateAt: 0.68 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function phaseOf(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / Math.max(0.001, end - start));
}

// ─── SVG filter defs ─────────────────────────────────────────────────────────

function Defs({ id }: { id: string }) {
  return (
    <defs>
      <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${id}-strong-glow`} x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="10" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <pattern id={`${id}-dots`} width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="10" cy="10" r="0.8" fill="hsl(var(--foreground) / 0.06)" />
      </pattern>
      <marker id={`${id}-arrow`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="rgba(34,211,238,0.7)" />
      </marker>
      <marker
        id={`${id}-arrow-dim`}
        markerWidth="6"
        markerHeight="6"
        refX="5"
        refY="3"
        orient="auto"
      >
        <path d="M0,0 L0,6 L6,3 z" fill="hsl(var(--muted-foreground) / 0.6)" />
      </marker>
    </defs>
  );
}

// ─── Animated edge ────────────────────────────────────────────────────────────

function Edge({
  edge,
  nodes,
  progress,
  filterId,
}: {
  edge: EdgeDef;
  nodes: NodeDef[];
  progress: number;
  filterId: string;
}) {
  const fromNode = nodes.find((n) => n.id === edge.from);
  const toNode = nodes.find((n) => n.id === edge.to);
  if (!fromNode || !toNode) return null;

  const DRAW_DURATION = 0.08;
  const drawPhase = phaseOf(progress, edge.activateAt, edge.activateAt + DRAW_DURATION);
  const isActive = drawPhase >= 1;

  const x1 = fromNode.x;
  const y1 = fromNode.isRoot ? fromNode.y + 28 : fromNode.y + 24;
  const x2 = toNode.x;
  const y2 = toNode.y - 24;

  // Bezier control points
  const midY = lerp(y1, y2, 0.5);
  const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  // Particle animation along the path
  const particleActive = isActive && progress < 0.95;

  // Approximate path length for dash trick
  const dx = x2 - x1;
  const dy = y2 - y1;
  const approxLen = Math.sqrt(dx * dx + dy * dy) * 1.3;

  return (
    <g>
      {/* Dim background track */}
      <path
        d={pathD}
        fill="none"
        stroke="hsl(var(--muted) / 0.8)"
        strokeWidth={1.5}
        markerEnd={`url(#${filterId}-arrow-dim)`}
      />

      {/* Animated draw line */}
      {drawPhase > 0 && (
        <path
          d={pathD}
          fill="none"
          stroke={isActive ? "rgba(34,211,238,0.7)" : "rgba(34,211,238,0.5)"}
          strokeWidth={isActive ? 2 : 1.5}
          strokeDasharray={`${approxLen * drawPhase} ${approxLen}`}
          markerEnd={isActive ? `url(#${filterId}-arrow)` : undefined}
          filter={isActive ? `url(#${filterId}-glow)` : undefined}
        />
      )}

      {/* Flowing particle */}
      {particleActive && (
        <motion.circle
          r={3}
          fill="#22d3ee"
          filter={`url(#${filterId}-strong-glow)`}
          animate={{
            offsetDistance: ["0%", "100%"],
          }}
          style={{
            offsetPath: `path("${pathD}")`,
            offsetDistance: "0%",
          }}
          transition={{
            repeat: Infinity,
            duration: 1.8,
            ease: "linear",
            delay: (edge.activateAt * 3) % 1.5,
          }}
        />
      )}
    </g>
  );
}

// ─── Node circle ─────────────────────────────────────────────────────────────

function Node({ node, progress, filterId }: { node: NodeDef; progress: number; filterId: string }) {
  const APPEAR_DURATION = 0.08;
  const appearPhase = phaseOf(
    progress,
    node.isRoot ? 0 : node.activateAt - 0.05,
    node.activateAt + APPEAR_DURATION,
  );
  const isLit = appearPhase >= 1 && (node.isRoot ? progress >= 0.2 : true);

  // Root pulses when first activated
  const rootActivatePhase = node.isRoot ? phaseOf(progress, 0.2, 0.4) : 0;

  const r = node.isRoot ? 30 : 22;

  // PR badge appears after node lights up
  const prPhase = node.isRoot
    ? 0
    : phaseOf(progress, node.activateAt + 0.06, node.activateAt + 0.14);
  const showPr = prPhase > 0;

  const nodeColor = node.isRoot
    ? progress >= 0.2
      ? "#22d3ee"
      : "hsl(var(--muted-foreground) / 0.5)"
    : isLit
      ? "#22d3ee"
      : "hsl(var(--muted-foreground) / 0.5)";

  const strokeColor = node.isRoot
    ? progress >= 0.2
      ? "#22d3ee"
      : "hsl(var(--muted) / 0.9)"
    : isLit
      ? "#22d3ee"
      : "hsl(var(--muted) / 0.9)";

  const fillColor = node.isRoot
    ? progress >= 0.2
      ? "rgba(34,211,238,0.12)"
      : "hsl(var(--muted) / 0.8)"
    : isLit
      ? "rgba(34,211,238,0.1)"
      : "hsl(var(--muted) / 0.8)";

  const labelColor =
    isLit || (node.isRoot && progress >= 0.2) ? "hsl(var(--foreground) / 0.9)" : "hsl(var(--muted-foreground) / 0.8)";
  const sublabelColor =
    isLit || (node.isRoot && progress >= 0.2) ? "rgba(34,211,238,0.7)" : "hsl(var(--muted-foreground) / 0.7)";

  return (
    <g transform={`translate(${node.x}, ${node.y})`} opacity={appearPhase}>
      {/* Glow halo when lit */}
      {(isLit || (node.isRoot && progress >= 0.2)) && (
        <circle r={r + 8} fill="rgba(34,211,238,0.05)" filter={`url(#${filterId}-glow)`} />
      )}

      {/* Root pulse ring */}
      {node.isRoot && rootActivatePhase > 0 && rootActivatePhase < 1 && (
        <circle
          r={r + 8 + rootActivatePhase * 24}
          fill="none"
          stroke="rgba(34,211,238,0.3)"
          strokeWidth={2}
          opacity={1 - rootActivatePhase}
        />
      )}

      {/* Node circle */}
      <circle
        r={r}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={node.isRoot ? 2 : 1.5}
        filter={isLit || (node.isRoot && progress >= 0.2) ? `url(#${filterId}-glow)` : undefined}
        style={{ transition: "fill 0.4s ease, stroke 0.4s ease" }}
      />

      {/* Label */}
      <text
        y={-6}
        textAnchor="middle"
        fill={nodeColor}
        fontSize={node.isRoot ? 10 : 9}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        letterSpacing={0.5}
      >
        {node.isRoot
          ? "shared"
          : node.label.length > 10
            ? node.label.slice(0, 9) + "…"
            : node.label}
      </text>
      <text
        y={8}
        textAnchor="middle"
        fill={sublabelColor}
        fontSize={7.5}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing={0.3}
        style={{ transition: "fill 0.4s ease" }}
      >
        {node.isRoot
          ? "@spike-land-ai"
          : node.sublabel.length > 12
            ? node.sublabel.slice(0, 11) + "…"
            : node.sublabel}
      </text>

      {/* Full label below circle */}
      <text
        y={r + 14}
        textAnchor="middle"
        fill={labelColor}
        fontSize={8}
        fontFamily="JetBrains Mono, monospace"
        style={{ transition: "fill 0.4s ease" }}
      >
        {node.isRoot ? "" : node.label}
      </text>

      {/* PR badge */}
      {showPr && (
        <g transform={`translate(${r - 4}, ${-r + 2})`} opacity={prPhase}>
          <rect
            x={-14}
            y={-10}
            width={28}
            height={14}
            rx={3}
            fill="rgba(34,197,94,0.15)"
            stroke="rgba(34,197,94,0.5)"
            strokeWidth={0.8}
          />
          <text
            textAnchor="middle"
            y={2}
            fill="rgba(34,197,94,0.9)"
            fontSize={7}
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
            letterSpacing={0.5}
          >
            PR
          </text>
        </g>
      )}
    </g>
  );
}

// ─── Counter badge ────────────────────────────────────────────────────────────

function CounterBadge({ progress }: { progress: number }) {
  const counterPhase = phaseOf(progress, 0.8, 1.0);
  if (counterPhase <= 0) return null;

  const count = Math.round(lerp(0, 18, counterPhase));

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 8 }}
      animate={{ opacity: counterPhase, scale: 1, y: 0 }}
      className="flex items-center justify-center gap-3 mt-2"
    >
      <div
        className="flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-sm font-bold"
        style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid rgba(34,197,94,0.35)",
          color: "#4ade80",
          boxShadow: "0 0 20px rgba(34,197,94,0.1)",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>{count} repos updated</span>
      </div>
      {counterPhase > 0.5 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[10px] font-mono text-slate-500 uppercase tracking-widest"
        >
          auto-merge pending
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export function DependencyCascadeDemo() {
  const { ref, progress } = useInViewProgress();

  const instanceId = "dep-cascade";

  // Determine root glow phase
  const rootGlowPhase = phaseOf(progress, 0.2, 0.4);

  // Publish event label
  const publishPhase = phaseOf(progress, 0.15, 0.35);

  return (
    <div
      ref={ref}
      className="bg-card/40 border border-border/80 rounded-[2.5rem] p-10 md:p-16 my-20 backdrop-blur-md relative overflow-hidden group"
    >
      {/* Hover gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none" />

      {/* Background radial */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-40 bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-40 bg-emerald-500/5 blur-3xl pointer-events-none" />

      {/* Publish event chip */}
      <div className="flex justify-center mb-6">
        <motion.div
          animate={{ opacity: publishPhase > 0 ? 1 : 0.4 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border font-mono text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{
            background: publishPhase > 0.5 ? "rgba(34,211,238,0.08)" : "hsl(var(--muted) / 0.5)",
            borderColor: publishPhase > 0.5 ? "rgba(34,211,238,0.3)" : "hsl(var(--border) / 0.6)",
            color: publishPhase > 0.5 ? "#22d3ee" : "hsl(var(--muted-foreground) / 0.7)",
            transition: "all 0.5s ease",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: publishPhase > 0.5 ? "#22d3ee" : "hsl(var(--muted-foreground) / 0.4)",
              boxShadow: publishPhase > 0.5 ? "0 0 6px #22d3ee" : "none",
              animation: publishPhase > 0.5 ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
          />
          {publishPhase > 0.7
            ? "Cascade in progress"
            : publishPhase > 0
              ? "npm publish fired"
              : "Awaiting publish event"}
        </motion.div>
      </div>

      {/* SVG DAG */}
      <div className="w-full" style={{ aspectRatio: "800/480" }}>
        <svg
          viewBox="0 0 800 480"
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full"
          style={{ display: "block" }}
        >
          <Defs id={instanceId} />

          {/* Background */}
          <rect width="800" height="480" fill="rgba(2,6,23,0.5)" rx="16" />
          <rect width="800" height="480" fill={`url(#${instanceId}-dots)`} rx="16" />

          {/* Root halo when publish fires */}
          {rootGlowPhase > 0 && (
            <circle
              cx={400}
              cy={80}
              r={30 + rootGlowPhase * 18}
              fill="none"
              stroke="rgba(34,211,238,0.2)"
              strokeWidth={2}
              opacity={1 - rootGlowPhase * 0.7}
              filter={`url(#${instanceId}-glow)`}
            />
          )}

          {/* Edges */}
          {EDGES.map((edge) => (
            <Edge
              key={`${edge.from}-${edge.to}`}
              edge={edge}
              nodes={NODES}
              progress={progress}
              filterId={instanceId}
            />
          ))}

          {/* Nodes */}
          {NODES.map((node) => (
            <Node key={node.id} node={node} progress={progress} filterId={instanceId} />
          ))}

          {/* "publish" label near root */}
          {publishPhase > 0.3 && (
            <g transform="translate(400, 36)" opacity={Math.min(1, (publishPhase - 0.3) / 0.3)}>
              <rect
                x={-42}
                y={-12}
                width={84}
                height={18}
                rx={4}
                fill="rgba(34,211,238,0.08)"
                stroke="rgba(34,211,238,0.35)"
                strokeWidth={0.8}
              />
              <text
                textAnchor="middle"
                y={3}
                fill="rgba(34,211,238,0.85)"
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
                letterSpacing={1.2}
              >
                npm publish
              </text>
            </g>
          )}

          {/* Repo count label bottom-right */}
          {progress >= 0.8 && (
            <g transform="translate(700, 460)" opacity={Math.min(1, (progress - 0.8) / 0.15)}>
              <rect
                x={-58}
                y={-14}
                width={116}
                height={20}
                rx={4}
                fill="rgba(34,197,94,0.08)"
                stroke="rgba(34,197,94,0.3)"
                strokeWidth={0.8}
              />
              <text
                textAnchor="middle"
                y={2}
                fill="rgba(34,197,94,0.85)"
                fontSize={9}
                fontFamily="JetBrains Mono, monospace"
                fontWeight="bold"
                letterSpacing={0.8}
              >
                {Math.round(lerp(0, 18, (progress - 0.8) / 0.2))} repos updated
              </text>
            </g>
          )}

          {/* Legend */}
          <g transform="translate(16, 462)" opacity={Math.min(1, progress * 5)}>
            <circle
              cx={6}
              cy={0}
              r={4}
              fill="rgba(34,211,238,0.15)"
              stroke="rgba(34,211,238,0.6)"
              strokeWidth={1}
            />
            <text
              x={16}
              y={4}
              fill="rgba(100,116,139,0.7)"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
            >
              Lit = updated
            </text>
            <rect
              x={100}
              y={-5}
              width={20}
              height={12}
              rx={2}
              fill="rgba(34,197,94,0.12)"
              stroke="rgba(34,197,94,0.45)"
              strokeWidth={0.7}
            />
            <text
              x={103}
              y={3}
              fill="rgba(34,197,94,0.8)"
              fontSize={7}
              fontFamily="JetBrains Mono, monospace"
              fontWeight="bold"
            >
              PR
            </text>
            <text
              x={126}
              y={4}
              fill="rgba(100,116,139,0.7)"
              fontSize={9}
              fontFamily="JetBrains Mono, monospace"
            >
              auto-PR opened
            </text>
          </g>
        </svg>
      </div>

      {/* Counter badge below SVG */}
      <CounterBadge progress={progress} />

      {/* Caption */}
      <div className="flex flex-col items-center gap-3 mt-10">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-border to-transparent" />
        <p className="text-center text-[10px] font-mono text-muted-foreground tracking-[0.2em] uppercase max-w-md leading-relaxed">
          One publish triggers a repository_dispatch cascade — every consumer receives an auto-merge
          PR
        </p>
      </div>
    </div>
  );
}
