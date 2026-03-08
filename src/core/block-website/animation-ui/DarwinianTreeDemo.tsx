"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInViewProgress } from "../ui/useInViewProgress";

// ─── Types ─────────────────────────────────────────────────────────────────

type Point = { x: number; y: number };

type BranchDef = {
  id: string;
  from: Point;
  to: Point;
  generation: number;
  survives: boolean;
  fitness: number;
  delayFraction: number;
};

type ParticleDef = {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  branchId: string;
};

// ─── Tree builder ─────────────────────────────────────────────────────────

function buildTree(maxGenerations: number): BranchDef[] {
  const branches: BranchDef[] = [];

  const root: Point = { x: 400, y: 500 };
  const gen0End: Point = { x: 400, y: 340 };
  branches.push({
    id: "g0-trunk",
    from: root,
    to: gen0End,
    generation: 0,
    survives: true,
    fitness: 88,
    delayFraction: 0,
  });

  if (maxGenerations < 1) return branches;

  const gen1: Array<{ to: Point; survives: boolean; fitness: number; delay: number }> = [
    { to: { x: 250, y: 200 }, survives: true, fitness: 74, delay: 0.02 },
    { to: { x: 560, y: 210 }, survives: false, fitness: 31, delay: 0.04 },
  ];
  gen1.forEach((n, i) => {
    branches.push({
      id: `g1-${i}`,
      from: gen0End,
      to: n.to,
      generation: 1,
      survives: n.survives,
      fitness: n.fitness,
      delayFraction: 0.18 + n.delay,
    });
  });

  if (maxGenerations < 2) return branches;

  const g1Survivor = gen1[0]!.to;
  const gen2: Array<{ to: Point; survives: boolean; fitness: number; delay: number }> = [
    { to: { x: 160, y: 90 }, survives: true, fitness: 91, delay: 0.01 },
    { to: { x: 340, y: 110 }, survives: false, fitness: 22, delay: 0.03 },
  ];
  gen2.forEach((n, i) => {
    branches.push({
      id: `g2-${i}`,
      from: g1Survivor,
      to: n.to,
      generation: 2,
      survives: n.survives,
      fitness: n.fitness,
      delayFraction: 0.42 + n.delay,
    });
  });

  const g1Failed = gen1[1]!.to;
  branches.push({
    id: "g2-fail-a",
    from: g1Failed,
    to: { x: 500, y: 110 },
    generation: 2,
    survives: false,
    fitness: 18,
    delayFraction: 0.44,
  });
  branches.push({
    id: "g2-fail-b",
    from: g1Failed,
    to: { x: 630, y: 120 },
    generation: 2,
    survives: false,
    fitness: 11,
    delayFraction: 0.47,
  });

  if (maxGenerations < 3) return branches;

  const g2Survivor = gen2[0]!.to;
  const gen3: Array<{ to: Point; survives: boolean; fitness: number; delay: number }> = [
    { to: { x: 90, y: 20 }, survives: true, fitness: 97, delay: 0.01 },
    { to: { x: 200, y: 15 }, survives: false, fitness: 43, delay: 0.02 },
    { to: { x: 130, y: 5 }, survives: false, fitness: 29, delay: 0.035 },
  ];
  gen3.forEach((n, i) => {
    branches.push({
      id: `g3-${i}`,
      from: g2Survivor,
      to: n.to,
      generation: 3,
      survives: n.survives,
      fitness: n.fitness,
      delayFraction: 0.65 + n.delay,
    });
  });

  return branches;
}

function buildParticles(branches: BranchDef[]): ParticleDef[] {
  const kbX = 400;
  const kbY = 530;
  const particles: ParticleDef[] = [];
  branches
    .filter((b) => !b.survives)
    .forEach((b, bi) => {
      for (let i = 0; i < 3; i++) {
        const offsetX = (i - 1) * 20 + (bi % 2 === 0 ? 5 : -5);
        particles.push({
          id: `particle-${b.id}-${i}`,
          startX: b.to.x + offsetX,
          startY: b.to.y,
          endX: kbX + (i - 1) * 30,
          endY: kbY,
          branchId: b.id,
        });
      }
    });
  return particles;
}

// ─── SVG helpers ───────────────────────────────────────────────────────────

function cubicPath(from: Point, to: Point): string {
  const midY = (from.y + to.y) / 2;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

function approxLength(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy) * 1.2;
}

// ─── Color constants ────────────────────────────────────────────────────────

const C_SURVIVE = "#22c55e";
const C_FAIL = "#ef4444";
const C_TRUNK = "#3b82f6";
const C_PARTICLE = "#10b981";
const PRUNE_FRACTION = 0.12;

// ─── AnimatedBranch ─────────────────────────────────────────────────────────

type AnimatedBranchProps = {
  branch: BranchDef;
  globalProgress: number;
  glowFilterId: string;
  strongGlowFilterId: string;
};

function AnimatedBranch({
  branch,
  globalProgress,
  glowFilterId,
  strongGlowFilterId,
}: AnimatedBranchProps) {
  const pathD = cubicPath(branch.from, branch.to);
  const pathLen = approxLength(branch.from, branch.to);
  const branchDuration = 0.15;
  const drawProgress = Math.max(
    0,
    Math.min(1, (globalProgress - branch.delayFraction) / branchDuration),
  );
  if (drawProgress <= 0) return null;

  const pruneStart = branch.delayFraction + PRUNE_FRACTION;
  const pruneProgress = branch.survives
    ? 0
    : Math.max(0, Math.min(1, (globalProgress - pruneStart) / 0.08));
  const opacity = branch.survives ? 1 : Math.max(0.08, 1 - pruneProgress);
  const strokeColor = branch.generation === 0 ? C_TRUNK : branch.survives ? C_SURVIVE : C_FAIL;
  const strokeWidth = branch.generation === 0 ? 5 : branch.generation === 1 ? 3.5 : 2.5;
  const dashLen = pathLen * drawProgress;
  const dashArray = `${dashLen} ${pathLen}`;
  const glitchX = pruneProgress > 0.3 ? Math.sin(pruneProgress * 30) * 3 : 0;
  const glitchY = pruneProgress > 0.3 ? Math.cos(pruneProgress * 25) * 2 : 0;
  const pulseOffset = -(globalProgress * 600) % (pathLen + 50);

  return (
    <g transform={`translate(${glitchX}, ${glitchY})`} style={{ opacity }}>
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth + 4}
        strokeLinecap="round"
        strokeDasharray={dashArray}
        opacity={0.2}
        filter={`url(#${glowFilterId})`}
      />
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={dashArray}
      />
      {branch.survives && drawProgress > 0.7 && (
        <path
          d={pathD}
          fill="none"
          stroke="white"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`8 ${pathLen}`}
          strokeDashoffset={pulseOffset}
          opacity={0.65}
          filter={`url(#${strongGlowFilterId})`}
        />
      )}
      {drawProgress > 0.85 && (
        <circle
          cx={branch.to.x}
          cy={branch.to.y}
          r={branch.generation === 0 ? 5 : 4}
          fill={strokeColor}
          opacity={opacity}
          filter={`url(#${glowFilterId})`}
        />
      )}
    </g>
  );
}

// ─── FitnessLabel ────────────────────────────────────────────────────────────

type FitnessLabelProps = {
  branch: BranchDef;
  globalProgress: number;
};

function FitnessLabel({ branch, globalProgress }: FitnessLabelProps) {
  if (branch.generation === 0) return null;
  const showAt = branch.delayFraction + 0.12;
  const labelProgress = Math.max(0, Math.min(1, (globalProgress - showAt) / 0.06));
  if (labelProgress <= 0) return null;

  const pruneStart = branch.delayFraction + PRUNE_FRACTION;
  const pruneProgress = branch.survives
    ? 0
    : Math.max(0, Math.min(1, (globalProgress - pruneStart) / 0.08));
  const opacity = Math.max(0, labelProgress * (1 - pruneProgress * 0.8));
  const color = branch.survives ? C_SURVIVE : C_FAIL;
  const isRight = branch.to.x > 400;
  const labelX = branch.to.x + (isRight ? 12 : -12);

  return (
    <g opacity={opacity}>
      <rect
        x={isRight ? labelX : labelX - 58}
        y={branch.to.y - 10}
        width={58}
        height={18}
        rx={3}
        fill={`${color}15`}
        stroke={`${color}40`}
        strokeWidth={0.5}
      />
      <text
        x={isRight ? labelX + 4 : labelX - 4}
        y={branch.to.y + 2}
        textAnchor={isRight ? "start" : "end"}
        fill={color}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        fontWeight="bold"
        letterSpacing={1}
      >
        {`FIT:${branch.fitness}`}
      </text>
    </g>
  );
}

// ─── LearningParticle ────────────────────────────────────────────────────────

type LearningParticleProps = {
  particle: ParticleDef;
  globalProgress: number;
  branchDelayFraction: number;
  strongGlowFilterId: string;
};

function LearningParticle({
  particle,
  globalProgress,
  branchDelayFraction,
  strongGlowFilterId,
}: LearningParticleProps) {
  const startAt = branchDelayFraction + PRUNE_FRACTION + 0.02;
  const particleProgress = Math.max(0, Math.min(1, (globalProgress - startAt) / 0.15));
  if (particleProgress <= 0 || particleProgress >= 1) return null;

  const eased = particleProgress * particleProgress;
  const px = particle.startX + (particle.endX - particle.startX) * particleProgress;
  const py = particle.startY + (particle.endY - particle.startY) * eased;

  return (
    <g transform={`translate(${px}, ${py})`} opacity={1 - particleProgress * 0.3}>
      <rect
        x="-4"
        y="-4"
        width="8"
        height="8"
        rx="2"
        fill={C_PARTICLE}
        filter={`url(#${strongGlowFilterId})`}
      />
      <text
        y="-8"
        fill={C_PARTICLE}
        fontSize={8}
        textAnchor="middle"
        opacity={0.85}
        fontFamily="JetBrains Mono, monospace"
      >
        {"\u0394"}
      </text>
    </g>
  );
}

// ─── DarwinianTreeSvg ─────────────────────────────────────────────────────────

type DarwinianTreeSvgProps = {
  generations: number;
  progress: number;
  instanceKey: number;
};

function DarwinianTreeSvg({ generations, progress, instanceKey }: DarwinianTreeSvgProps) {
  const idPrefix = `dtree-${instanceKey}`;
  const glowId = `${idPrefix}-glow`;
  const strongGlowId = `${idPrefix}-glow-strong`;
  const dotsId = `${idPrefix}-dots`;

  const branches = useMemo(() => buildTree(Math.min(3, Math.max(1, generations))), [generations]);
  const particles = useMemo(() => buildParticles(branches), [branches]);

  const kbGlow = Math.max(0, Math.min(0.25, (progress - 0.65) * 1.5));
  const legendOpacity = Math.max(0, Math.min(1, progress * 5));

  return (
    <svg
      viewBox="0 0 800 560"
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ display: "block" }}
    >
      <defs>
        <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={strongGlowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={dotsId} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1" fill="hsl(var(--foreground) / 0.07)" />
        </pattern>
      </defs>

      <rect width="800" height="560" fill="hsl(var(--card))" />
      <rect width="800" height="560" fill={`url(#${dotsId})`} />

      {([0, 1, 2, 3] as const).slice(0, generations + 1).map((gen) => {
        const yMap: Record<number, number> = { 0: 420, 1: 205, 2: 100, 3: 22 };
        const yPos = yMap[gen];
        const labelProgress = Math.max(0, Math.min(1, (progress - gen * 0.18) / 0.1));
        if (labelProgress <= 0) return null;
        return (
          <g key={`gen-label-${gen}`} opacity={labelProgress}>
            <text
              x={760}
              y={yPos}
              textAnchor="end"
              fill="hsl(var(--muted-foreground))"
              opacity={0.65}
              fontSize={10}
              fontFamily="JetBrains Mono, monospace"
              letterSpacing={1}
            >
              {`GEN ${gen}`}
            </text>
            <line
              x1={10}
              y1={yPos}
              x2={730}
              y2={yPos}
              stroke="hsl(var(--border))"
              opacity={0.5}
              strokeWidth={1}
              strokeDasharray="4 8"
            />
          </g>
        );
      })}

      {branches.map((branch) => (
        <AnimatedBranch
          key={branch.id}
          branch={branch}
          globalProgress={progress}
          glowFilterId={glowId}
          strongGlowFilterId={strongGlowId}
        />
      ))}

      {branches.map((branch) => (
        <FitnessLabel key={`label-${branch.id}`} branch={branch} globalProgress={progress} />
      ))}

      {particles.map((particle) => {
        const parentBranch = branches.find((b) => b.id === particle.branchId);
        if (!parentBranch) return null;
        return (
          <LearningParticle
            key={particle.id}
            particle={particle}
            globalProgress={progress}
            branchDelayFraction={parentBranch.delayFraction}
            strongGlowFilterId={strongGlowId}
          />
        );
      })}

      <g transform="translate(400, 525)" opacity={Math.max(0, Math.min(1, progress * 4))}>
        <rect
          x={-160}
          y={-14}
          width={320}
          height={28}
          rx={4}
          fill="hsl(var(--muted) / 0.9)"
          stroke="rgba(16,185,129,0.35)"
          strokeWidth={1}
        />
        <rect
          x={-160}
          y={-14}
          width={320}
          height={28}
          rx={4}
          fill={C_PARTICLE}
          opacity={kbGlow}
          filter={`url(#${strongGlowId})`}
        />
        <text
          y={5}
          textAnchor="middle"
          fill={C_PARTICLE}
          fontSize={10}
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
          letterSpacing={3}
        >
          EXTRACTED KNOWLEDGE BASE
        </text>
      </g>

      <g transform="translate(16, 540)" opacity={legendOpacity}>
        <rect x={0} y={-3} width={14} height={4} rx={2} fill={C_SURVIVE} />
        <text
          x={20}
          y={4}
          fill="hsl(var(--muted-foreground))"
          opacity={0.7}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
        >
          Survives
        </text>
        <rect x={100} y={-3} width={14} height={4} rx={2} fill={C_FAIL} />
        <text
          x={120}
          y={4}
          fill="hsl(var(--muted-foreground))"
          opacity={0.7}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
        >
          Failed
        </text>
        <rect x={190} y={-7} width={10} height={10} rx={2} fill={C_PARTICLE} />
        <text
          x={206}
          y={4}
          fill="hsl(var(--muted-foreground))"
          opacity={0.7}
          fontSize={9}
          fontFamily="JetBrains Mono, monospace"
        >
          Learning {"\u0394"}
        </text>
      </g>
    </svg>
  );
}

// ─── useAutoProgress ──────────────────────────────────────────────────────────

function useAutoProgress(active: boolean, durationMs: number): number {
  const [internalProgress, setInternalProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    startTimeRef.current = null;
    setInternalProgress(0);

    function tick(now: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = now;
      }
      const elapsed = now - startTimeRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setInternalProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, durationMs]);

  return internalProgress;
}

// ─── DarwinianTreeDemo ────────────────────────────────────────────────────────

export function DarwinianTreeDemo() {
  const { ref, progress: scrollProgress } = useInViewProgress();
  const [generations, setGenerations] = useState(3);
  const [instanceKey, setInstanceKey] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  const autoProgress = useAutoProgress(isAutoPlaying, 4000);
  const effectiveProgress = isAutoPlaying ? autoProgress : scrollProgress;

  useEffect(() => {
    if (isAutoPlaying && autoProgress >= 1) {
      setIsAutoPlaying(false);
    }
  }, [isAutoPlaying, autoProgress]);

  function handleResimulate() {
    setInstanceKey((k) => k + 1);
    setIsAutoPlaying(true);
  }

  return (
    <div ref={ref} className="my-8 flex flex-col gap-6 group">
      <div className="rounded-xl overflow-hidden border border-border shadow-2xl shadow-emerald-900/10 aspect-[16/10] sm:aspect-video bg-card relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={instanceKey}
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <DarwinianTreeSvg
              generations={generations}
              progress={effectiveProgress}
              instanceKey={instanceKey}
            />
          </motion.div>
        </AnimatePresence>

        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isAutoPlaying ? "bg-emerald-400 animate-pulse" : "bg-muted"
            }`}
            style={{
              boxShadow: isAutoPlaying ? "0 0 8px rgba(52,211,153,0.8)" : "none",
            }}
          />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            {isAutoPlaying ? "Simulating..." : "Natural Selection"}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 p-6 sm:p-8 rounded-xl bg-card/80 backdrop-blur-xl border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <svg width="40" height="40" viewBox="0 0 100 100" className="stroke-emerald-500">
            <circle cx="50" cy="50" r="40" fill="none" strokeWidth="2" strokeDasharray="4 8" />
            <circle cx="50" cy="50" r="20" fill="none" strokeWidth="2" />
          </svg>
        </div>

        <div className="flex-1 space-y-4 z-10">
          <div className="flex justify-between items-center mb-5">
            <span className="text-sm font-bold text-emerald-500 uppercase tracking-[0.15em] font-mono flex items-center gap-3">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              Generation Depth
            </span>
          </div>

          <div className="flex gap-3">
            {[1, 2, 3].map((gen) => (
              <button
                key={gen}
                onClick={() => {
                  setGenerations(gen);
                  setInstanceKey((k) => k + 1);
                  setIsAutoPlaying(true);
                }}
                className={`flex-1 py-2 text-sm font-mono rounded-md border transition-all ${
                  generations === gen
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                    : "bg-muted text-muted-foreground border-border hover:border-slate-700"
                }`}
              >
                Gen {gen}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground font-mono leading-relaxed border-l-2 border-border pl-4 mt-6">
            Code writes code testing code. Failed syntaxes are aggressively pruned, but their delta
            is extracted as learning notes.
          </p>

          <div className="flex gap-4 flex-wrap mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              <span className="text-[11px] font-mono text-muted-foreground">
                High fitness survives
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
              <span className="text-[11px] font-mono text-muted-foreground">
                Low fitness pruned
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center sm:pl-6 sm:border-l border-border z-10 w-full sm:w-auto">
          <button
            onClick={handleResimulate}
            disabled={isAutoPlaying}
            className={`flex items-center justify-center gap-2 px-6 py-4 border rounded-lg font-mono text-sm uppercase tracking-widest transition-all ${
              isAutoPlaying
                ? "bg-muted/50 text-muted-foreground border-border cursor-not-allowed"
                : "bg-muted hover:bg-muted/80 text-emerald-400 border-emerald-900/50 hover:border-emerald-500/50 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`opacity-70 ${isAutoPlaying ? "animate-spin" : ""}`}
            >
              <path d="M21.5 2v6h-6M2.13 15.57a10 10 0 1 0 3.43-12.14l-5.1 3.57" />
            </svg>
            {isAutoPlaying ? "Running..." : "Re-simulate"}
          </button>
        </div>
      </div>
    </div>
  );
}
