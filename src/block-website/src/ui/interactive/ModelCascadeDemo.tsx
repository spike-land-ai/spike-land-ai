"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useInViewProgress } from "./useInViewProgress";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelTier = "opus" | "sonnet" | "haiku";

type TaskComplexity = "complex" | "medium" | "simple";

interface TierConfig {
  label: string;
  tagline: string;
  color: string;
  glow: string;
  costLabel: string;
  speedLabel: string;
  taskExamples: string[];
  qualityBars: number;
  speedBars: number;
}

interface IncomingTask {
  id: number;
  label: string;
  complexity: TaskComplexity;
  assignedTo: ModelTier;
  spawnedAt: number;
  lane: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_ORDER: ModelTier[] = ["opus", "sonnet", "haiku"];

const TIER_CONFIG: Record<ModelTier, TierConfig> = {
  opus: {
    label: "Claude Opus",
    tagline: "Deep reasoning & architecture",
    color: "#8b5cf6",
    glow: "rgba(139,92,246,0.3)",
    costLabel: "$$$",
    speedLabel: "1x",
    taskExamples: [
      "Design system architecture",
      "Reason about edge cases",
      "Multi-step planning",
      "Security audit",
    ],
    qualityBars: 5,
    speedBars: 1,
  },
  sonnet: {
    label: "Claude Sonnet",
    tagline: "Balanced code generation",
    color: "#3b82f6",
    glow: "rgba(59,130,246,0.3)",
    costLabel: "$$",
    speedLabel: "4x",
    taskExamples: [
      "Write component logic",
      "Refactor module",
      "Implement feature",
      "Generate tests",
    ],
    qualityBars: 4,
    speedBars: 3,
  },
  haiku: {
    label: "Claude Haiku",
    tagline: "Fast fixes & small diffs",
    color: "#0ea5e9",
    glow: "rgba(14,165,233,0.3)",
    costLabel: "$",
    speedLabel: "20x",
    taskExamples: ["Fix syntax error", "Format code", "Rename variable", "Add type annotation"],
    qualityBars: 3,
    speedBars: 5,
  },
};

const TASK_POOL: {
  label: string;
  complexity: TaskComplexity;
  tier: ModelTier;
}[] = [
  { label: "Arch design", complexity: "complex", tier: "opus" },
  { label: "Security audit", complexity: "complex", tier: "opus" },
  { label: "Edge case plan", complexity: "complex", tier: "opus" },
  { label: "Write component", complexity: "medium", tier: "sonnet" },
  { label: "Refactor module", complexity: "medium", tier: "sonnet" },
  { label: "Generate tests", complexity: "medium", tier: "sonnet" },
  { label: "Fix lint error", complexity: "simple", tier: "haiku" },
  { label: "Rename symbol", complexity: "simple", tier: "haiku" },
  { label: "Add types", complexity: "simple", tier: "haiku" },
];

const TASK_INTERVAL_MS = 1600;
const TASK_LIFETIME_MS = 4000;
const MAX_LANES = 3;

// SVG constants
const SVG_W = 480;
const SVG_H = 320;
const TIER_Y: Record<ModelTier, number> = { opus: 70, sonnet: 170, haiku: 270 };
const CARD_W = 340;
const CARD_H = 52;
const DISPATCHER_X = 30;
const DISPATCHER_Y = SVG_H / 2;
const CARD_X = 120;

// ─── Sub-components ──────────────────────────────────────────────────────────

interface MetricBarsProps {
  count: number;
  max: number;
  color: string;
}

function MetricBars({ count, max, color }: MetricBarsProps) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className="block w-3 h-2 rounded-sm transition-all duration-300"
          style={{
            backgroundColor: i < count ? color : "hsl(var(--muted))",
            boxShadow: i < count ? `0 0 4px ${color}` : "none",
          }}
        />
      ))}
    </div>
  );
}

interface TierCardProps {
  tier: ModelTier;
  active: boolean;
  filterId: string;
  tasks: IncomingTask[];
  now: number;
}

function TierCard({ tier, active, filterId, tasks, now }: TierCardProps) {
  const cfg = TIER_CONFIG[tier];
  const y = TIER_Y[tier];
  const tierTasks = tasks.filter((t) => t.assignedTo === tier);

  return (
    <g>
      <rect
        x={CARD_X}
        y={y - CARD_H / 2}
        width={CARD_W}
        height={CARD_H}
        rx={6}
        fill="hsl(var(--card) / 0.9)"
        stroke={cfg.color}
        strokeWidth={active ? 2 : 1}
        strokeOpacity={active ? 1 : 0.3}
        filter={active ? `url(#${filterId})` : undefined}
        style={{ transition: "stroke-opacity 0.4s, stroke-width 0.4s" }}
      />

      {/* Left accent bar */}
      <rect
        x={CARD_X}
        y={y - CARD_H / 2}
        width={4}
        height={CARD_H}
        rx={3}
        fill={cfg.color}
        opacity={active ? 1 : 0.4}
      />

      {/* Model label */}
      <text
        x={CARD_X + 18}
        y={y - 6}
        fontSize={12}
        fontWeight={700}
        fill={active ? "currentColor" : "hsl(var(--muted-foreground))"}
        fontFamily="ui-monospace, monospace"
        letterSpacing={0.5}
      >
        {cfg.label}
      </text>

      {/* Tagline */}
      <text
        x={CARD_X + 18}
        y={y + 10}
        fontSize={9}
        fill={active ? cfg.color : "hsl(var(--muted-foreground))"}
        opacity={0.8}
        fontFamily="ui-monospace, monospace"
      >
        {cfg.tagline}
      </text>

      {/* Cost badge */}
      <rect
        x={CARD_X + CARD_W - 110}
        y={y - 20}
        width={46}
        height={18}
        rx={3}
        fill={`${cfg.color}18`}
        stroke={cfg.color}
        strokeWidth={0.5}
        strokeOpacity={active ? 0.8 : 0.3}
      />
      <text
        x={CARD_X + CARD_W - 110 + 5}
        y={y - 6}
        fontSize={8}
        fill="hsl(var(--muted-foreground))"
        fontFamily="ui-monospace, monospace"
      >
        COST
      </text>
      <text
        x={CARD_X + CARD_W - 110 + 25}
        y={y - 6}
        fontSize={10}
        fontWeight={700}
        fill={active ? cfg.color : "hsl(var(--muted-foreground))"}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
      >
        {cfg.costLabel}
      </text>

      {/* Speed badge */}
      <rect
        x={CARD_X + CARD_W - 56}
        y={y - 20}
        width={46}
        height={18}
        rx={3}
        fill={`${cfg.color}18`}
        stroke={cfg.color}
        strokeWidth={0.5}
        strokeOpacity={active ? 0.8 : 0.3}
      />
      <text
        x={CARD_X + CARD_W - 56 + 5}
        y={y - 6}
        fontSize={8}
        fill="hsl(var(--muted-foreground))"
        fontFamily="ui-monospace, monospace"
      >
        SPD
      </text>
      <text
        x={CARD_X + CARD_W - 56 + 28}
        y={y - 6}
        fontSize={10}
        fontWeight={700}
        fill={active ? cfg.color : "hsl(var(--muted-foreground))"}
        fontFamily="ui-monospace, monospace"
        textAnchor="middle"
      >
        {cfg.speedLabel}
      </text>

      {/* Active indicator */}
      {active && (
        <circle cx={CARD_X + CARD_W - 12} cy={y + 12} r={3.5} fill={cfg.color}>
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Animated task pills */}
      {tierTasks.map((task) => {
        const elapsed = now - task.spawnedAt;
        const tProgress = Math.min(elapsed / TASK_LIFETIME_MS, 1);
        const startX = CARD_X - 10;
        const endX = CARD_X + 50 + task.lane * 80;
        const taskX = startX + (endX - startX) * Math.min(tProgress * 2, 1);
        const taskOpacity =
          tProgress > 0.7 ? 1 - (tProgress - 0.7) / 0.3 : Math.min(tProgress * 5, 1);
        return (
          <g key={task.id} opacity={taskOpacity}>
            <rect
              x={taskX}
              y={y + 15}
              width={72}
              height={14}
              rx={7}
              fill={`${cfg.color}22`}
              stroke={cfg.color}
              strokeWidth={0.8}
            />
            <text
              x={taskX + 36}
              y={y + 25}
              fontSize={7}
              fill={cfg.color}
              fontFamily="ui-monospace, monospace"
              textAnchor="middle"
            >
              {task.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ModelCascadeDemo() {
  const { ref, progress } = useInViewProgress();
  const svgId = useId();
  const filterId = `glow-cascade-${svgId.replace(/:/g, "")}`;
  const arrowId = `arrow-${svgId.replace(/:/g, "")}`;

  const [activeTier, setActiveTier] = useState<ModelTier | null>(null);
  const [tasks, setTasks] = useState<IncomingTask[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const nextTaskId = useRef(0);
  const taskPoolIdx = useRef(0);
  const animFrameRef = useRef<number>(0);
  const lastTaskRef = useRef<number>(Date.now());

  useEffect(() => {
    const tick = () => {
      setNow(Date.now());

      if (Date.now() - lastTaskRef.current > TASK_INTERVAL_MS) {
        lastTaskRef.current = Date.now();
        const poolItem = TASK_POOL[taskPoolIdx.current % TASK_POOL.length];
        if (poolItem) {
          taskPoolIdx.current++;
          const newTask: IncomingTask = {
            id: nextTaskId.current++,
            label: poolItem.label,
            complexity: poolItem.complexity,
            assignedTo: poolItem.tier,
            spawnedAt: Date.now(),
            lane: Math.floor(Math.random() * MAX_LANES),
          };
          setTasks((prev) => {
            const pruned = prev.filter((t) => Date.now() - t.spawnedAt < TASK_LIFETIME_MS + 200);
            return [...pruned, newTask];
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const displayedTier = activeTier ?? "sonnet";
  const displayedConfig = TIER_CONFIG[displayedTier];

  return (
    <div ref={ref} className="my-8 flex flex-col gap-6 group">
      {/* Main visualization */}
      <div className="rounded-xl overflow-hidden border border-border shadow-2xl shadow-violet-900/10 bg-card relative p-4">
        <div className="absolute top-0 right-0 w-40 h-40 bg-violet-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row gap-6 items-start relative z-10">
          {/* SVG cascade diagram */}
          <div className="flex-1 w-full">
            <svg
              viewBox={`0 0 ${SVG_W} ${SVG_H}`}
              width="100%"
              className="block"
              aria-label="Model cascade routing diagram"
            >
              <defs>
                <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <marker
                  id={arrowId}
                  markerWidth="8"
                  markerHeight="6"
                  refX="7"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {/* Dispatcher node */}
              <g
                transform={`translate(${DISPATCHER_X}, ${DISPATCHER_Y})`}
                opacity={Math.min(1, progress * 3)}
              >
                <circle r={18} fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth={1.5} />
                <circle r={24} fill="none" stroke="hsl(var(--border))" strokeWidth={1} strokeDasharray="3 6">
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    from="0"
                    to="360"
                    dur="8s"
                    repeatCount="indefinite"
                  />
                </circle>
                <text
                  y={-4}
                  textAnchor="middle"
                  fontSize={7}
                  fontWeight={700}
                  fill="hsl(var(--muted-foreground))"
                  fontFamily="ui-monospace, monospace"
                  letterSpacing={0.5}
                >
                  ROUTE
                </text>
                <text
                  y={7}
                  textAnchor="middle"
                  fontSize={7}
                  fill="hsl(var(--muted-foreground))"
                  opacity={0.7}
                  fontFamily="ui-monospace, monospace"
                >
                  R
                </text>
              </g>

              {/* Routing lines */}
              {MODEL_ORDER.map((tier) => {
                const cfg = TIER_CONFIG[tier];
                const y = TIER_Y[tier];
                const isActive = tier === activeTier;
                const recentTask = tasks.filter((t) => t.assignedTo === tier).at(-1);
                const taskProgress = recentTask
                  ? Math.min((now - recentTask.spawnedAt) / 600, 1)
                  : 0;
                return (
                  <g key={`route-${tier}`}>
                    <line
                      x1={DISPATCHER_X + 18}
                      y1={DISPATCHER_Y}
                      x2={CARD_X - 2}
                      y2={y}
                      stroke={isActive ? cfg.color : "hsl(var(--border))"}
                      strokeWidth={isActive ? 2 : 1}
                      strokeDasharray={isActive ? "none" : "4 6"}
                      opacity={isActive ? 0.9 : 0.4}
                      markerEnd={`url(#${arrowId})`}
                      style={{ transition: "stroke 0.3s, opacity 0.3s" }}
                    />
                    {recentTask && taskProgress < 1 && (
                      <circle
                        cx={DISPATCHER_X + 18 + (CARD_X - DISPATCHER_X - 20) * taskProgress}
                        cy={DISPATCHER_Y + (y - DISPATCHER_Y) * taskProgress}
                        r={4}
                        fill={cfg.color}
                        opacity={1 - taskProgress * 0.5}
                        style={{ filter: `drop-shadow(0 0 3px ${cfg.color})` }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Tier cards */}
              {MODEL_ORDER.map((tier) => (
                <TierCard
                  key={tier}
                  tier={tier}
                  active={tier === activeTier}
                  filterId={filterId}
                  tasks={tasks}
                  now={now}
                />
              ))}

              {/* Title */}
              <text
                x={SVG_W / 2 + 40}
                y={16}
                textAnchor="middle"
                fontSize={10}
                fontWeight={600}
                fill="hsl(var(--muted-foreground))"
                fontFamily="ui-monospace, monospace"
                letterSpacing={2}
              >
                INTELLIGENT TASK ROUTER
              </text>
            </svg>
          </div>

          {/* Detail panel */}
          <div className="flex flex-col gap-4 w-full lg:w-64 flex-shrink-0">
            <div
              className="rounded-lg border p-4 transition-all duration-500"
              style={{
                borderColor: `${displayedConfig.color}40`,
                backgroundColor: `${displayedConfig.color}08`,
                boxShadow: `0 0 20px ${displayedConfig.glow}`,
              }}
            >
              <p
                className="text-xs font-bold font-mono uppercase tracking-widest mb-1"
                style={{ color: displayedConfig.color }}
              >
                {displayedConfig.label}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mb-3">{displayedConfig.tagline}</p>

              <div className="flex flex-col gap-2 text-[10px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground uppercase tracking-wider">Quality</span>
                  <MetricBars
                    count={displayedConfig.qualityBars}
                    max={5}
                    color={displayedConfig.color}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground uppercase tracking-wider">Speed</span>
                  <MetricBars
                    count={displayedConfig.speedBars}
                    max={5}
                    color={displayedConfig.color}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-muted-foreground uppercase tracking-wider">Cost</span>
                  <span className="text-sm font-bold" style={{ color: displayedConfig.color }}>
                    {displayedConfig.costLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground uppercase tracking-wider">Throughput</span>
                  <span style={{ color: displayedConfig.color }}>{displayedConfig.speedLabel}</span>
                </div>
              </div>
            </div>

            {/* Example tasks */}
            <div className="rounded-lg border border-border bg-muted/60 p-3">
              <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
                Task examples
              </p>
              <div className="flex flex-col gap-1">
                {displayedConfig.taskExamples.map((ex) => (
                  <div key={ex} className="flex items-center gap-2">
                    <span
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: displayedConfig.color }}
                    />
                    <span className="text-[10px] font-mono text-muted-foreground opacity-80">{ex}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls + description bar */}
      <div className="flex flex-col gap-4 p-5 rounded-xl bg-card/80 backdrop-blur-xl border border-border">
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 bg-violet-500 rounded-full animate-pulse flex-shrink-0"
            style={{ boxShadow: "0 0 6px rgba(139,92,246,0.8)" }}
          />
          <span className="text-xs font-bold text-violet-400 font-mono uppercase tracking-widest">
            Context Funnel Cascade
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {MODEL_ORDER.map((tier) => {
            const cfg = TIER_CONFIG[tier];
            const isActive = activeTier === tier;
            return (
              <button
                key={tier}
                onMouseEnter={() => setActiveTier(tier)}
                onMouseLeave={() => setActiveTier(null)}
                onClick={() => setActiveTier(isActive ? null : tier)}
                className="flex-1 flex flex-col gap-1 py-3 px-4 rounded-md border text-left transition-all duration-200"
                style={{
                  borderColor: isActive ? `${cfg.color}60` : "hsl(var(--border))",
                  backgroundColor: isActive ? `${cfg.color}10` : "hsl(var(--muted) / 0.6)",
                  boxShadow: isActive ? `0 0 16px ${cfg.glow}` : "none",
                }}
              >
                <span
                  className="text-xs font-bold font-mono"
                  style={{ color: isActive ? cfg.color : "hsl(var(--muted-foreground))" }}
                >
                  {cfg.label}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: isActive ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground) / 0.7)" }}
                  >
                    {cfg.costLabel}
                  </span>
                  <span className="text-[10px] text-muted-foreground opacity-30 font-mono">/</span>
                  <span
                    className="text-[10px] font-mono"
                    style={{ color: isActive ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground) / 0.7)" }}
                  >
                    {cfg.speedLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground font-mono leading-relaxed border-l-2 border-border pl-4">
          The router dispatches incoming tasks by complexity. Opus handles deep reasoning (100%
          cost, 1x speed), Sonnet writes code (50% cost, 4x speed), Haiku fixes syntax (5% cost, 20x
          speed). Hover a model to highlight its lane.
        </p>
      </div>
    </div>
  );
}
