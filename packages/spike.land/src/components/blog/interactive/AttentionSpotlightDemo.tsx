"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Token {
  id: number;
  label: string;
}

interface AttentionWeight {
  fromIdx: number;
  toIdx: number;
  weight: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SAMPLE_TOKENS: readonly string[] = [
  "The",
  "agent",
  "reads",
  "the",
  "context",
  "window",
  "carefully",
  "before",
  "generating",
  "output",
  "tokens",
  "that",
  "make",
  "sense",
  "given",
  "prior",
  "state",
  "and",
  "memory",
  "constraints",
];

/** Compute softmax over an array of raw scores */
function softmax(scores: readonly number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maxScore));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Generate deterministic attention weights for a query token index */
function computeAttentionWeights(queryIdx: number, tokenCount: number): AttentionWeight[] {
  const rawScores = Array.from({ length: tokenCount }, (_, i) => {
    const distance = Math.abs(i - queryIdx);
    const proximity = Math.exp(-distance * 0.4);
    const structural = i === 0 ? 0.6 : i === tokenCount - 1 ? 0.3 : 0;
    return proximity + structural;
  });

  const weights = softmax(rawScores);

  return weights.map((weight, toIdx) => ({
    fromIdx: queryIdx,
    toIdx,
    weight,
  }));
}

// ─── Token Bar Component ──────────────────────────────────────────────────────

interface TokenBarProps {
  tokens: Token[];
  activeQueryIdx: number;
  attentionWeights: AttentionWeight[];
  onSelectQuery: (idx: number) => void;
  shouldReduceMotion: boolean;
}

function TokenBar({
  tokens,
  activeQueryIdx,
  attentionWeights,
  onSelectQuery,
  shouldReduceMotion,
}: TokenBarProps) {
  const weightMap = new Map(attentionWeights.map((w) => [w.toIdx, w.weight]));
  const maxWeight = Math.max(...attentionWeights.map((w) => w.weight));

  return (
    <div className="flex flex-wrap gap-1.5 justify-center">
      {tokens.map((token, idx) => {
        const weight = weightMap.get(idx) ?? 0;
        const normalizedWeight = maxWeight > 0 ? weight / maxWeight : 0;
        const isQuery = idx === activeQueryIdx;

        const opacity = isQuery ? 1 : 0.25 + normalizedWeight * 0.75;
        const bgColor = isQuery
          ? "rgba(245, 158, 11, 0.25)"
          : `rgba(0, 229, 255, ${normalizedWeight * 0.2})`;
        const borderColor = isQuery
          ? "rgba(245, 158, 11, 0.8)"
          : `rgba(0, 229, 255, ${0.2 + normalizedWeight * 0.6})`;
        const textColor = isQuery ? "#F59E0B" : "#00E5FF";

        return (
          <motion.button
            key={token.id}
            onClick={() => onSelectQuery(idx)}
            animate={
              shouldReduceMotion
                ? {}
                : {
                    opacity,
                    scale: isQuery ? 1.15 : 0.9 + normalizedWeight * 0.15,
                  }
            }
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="px-2 py-1 rounded text-[11px] font-mono font-bold border cursor-pointer transition-shadow"
            style={{
              background: bgColor,
              borderColor,
              color: textColor,
              boxShadow: isQuery
                ? "0 0 12px rgba(245,158,11,0.5)"
                : normalizedWeight > 0.5
                  ? `0 0 8px rgba(0,229,255,${normalizedWeight * 0.4})`
                  : "none",
            }}
            aria-pressed={isQuery}
            aria-label={`Token: ${token.label}${isQuery ? " (query)" : ""}`}
          >
            {token.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Softmax Probability Bars ─────────────────────────────────────────────────

interface SoftmaxBarsProps {
  tokens: Token[];
  attentionWeights: AttentionWeight[];
  activeQueryIdx: number;
  shouldReduceMotion: boolean;
}

function SoftmaxBars({
  tokens,
  attentionWeights,
  activeQueryIdx,
  shouldReduceMotion,
}: SoftmaxBarsProps) {
  const maxWeight = Math.max(...attentionWeights.map((w) => w.weight));
  const sorted = [...attentionWeights].sort((a, b) => b.weight - a.weight).slice(0, 8);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Softmax distribution — query: &quot;{tokens[activeQueryIdx]?.label ?? "..."}&quot;
      </div>
      {sorted.map(({ toIdx, weight }) => {
        const barWidth = maxWeight > 0 ? (weight / maxWeight) * 100 : 0;
        const isQuery = toIdx === activeQueryIdx;
        return (
          <div key={toIdx} className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 w-20 flex-shrink-0 truncate text-right">
              {tokens[toIdx]?.label ?? ""}
            </span>
            <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: isQuery
                    ? "linear-gradient(90deg, #F59E0B, #FBBF24)"
                    : "linear-gradient(90deg, #00E5FF, #22c55e)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-[10px] font-mono text-slate-500 w-10 flex-shrink-0">
              {(weight * 100).toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Attention Arc SVG ────────────────────────────────────────────────────────

interface AttentionArcVisualizerProps {
  tokenCount: number;
  attentionWeights: AttentionWeight[];
  activeQueryIdx: number;
  shouldReduceMotion: boolean;
}

function AttentionArcVisualizer({
  tokenCount,
  attentionWeights,
  activeQueryIdx,
  shouldReduceMotion,
}: AttentionArcVisualizerProps) {
  const svgWidth = 600;
  const svgHeight = 120;
  const tokenSpacing = svgWidth / (tokenCount + 1);
  const baselineY = svgHeight - 20;

  const tokenX = (idx: number) => (idx + 1) * tokenSpacing;

  const weightMap = new Map(attentionWeights.map((w) => [w.toIdx, w.weight]));
  const maxWeight = Math.max(...attentionWeights.map((w) => w.weight));

  const queryX = tokenX(activeQueryIdx);

  return (
    <div className="relative bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <div className="text-[10px] font-mono uppercase tracking-widest text-slate-500 px-4 pt-3 pb-1 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        Attention arcs — select a query token above
      </div>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: 120 }}
        aria-label="Attention arc visualization"
        role="img"
      >
        {/* Baseline */}
        <line
          x1={tokenSpacing * 0.5}
          y1={baselineY}
          x2={svgWidth - tokenSpacing * 0.5}
          y2={baselineY}
          stroke="rgba(100,116,139,0.3)"
          strokeWidth={1}
        />

        {/* Glow corner accents */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500/10 blur-3xl pointer-events-none" />

        {/* Attention arcs */}
        {attentionWeights.map(({ toIdx, weight }) => {
          if (toIdx === activeQueryIdx) return null;
          const normalizedWeight = maxWeight > 0 ? weight / maxWeight : 0;
          if (normalizedWeight < 0.05) return null;

          const toX = tokenX(toIdx);
          const arcHeight = Math.abs(toX - queryX) * 0.5 * normalizedWeight + 10;
          const midX = (queryX + toX) / 2;
          const controlY = baselineY - arcHeight;

          return (
            <motion.path
              key={`arc-${toIdx}`}
              d={`M ${queryX} ${baselineY} Q ${midX} ${controlY} ${toX} ${baselineY}`}
              fill="none"
              stroke={`rgba(0,229,255,${normalizedWeight * 0.7})`}
              strokeWidth={normalizedWeight * 2.5}
              initial={shouldReduceMotion ? {} : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          );
        })}

        {/* Token dots */}
        {Array.from({ length: tokenCount }, (_, idx) => {
          const x = tokenX(idx);
          const weight = weightMap.get(idx) ?? 0;
          const normalizedWeight = maxWeight > 0 ? weight / maxWeight : 0;
          const isQuery = idx === activeQueryIdx;

          return (
            <circle
              key={`dot-${idx}`}
              cx={x}
              cy={baselineY}
              r={isQuery ? 6 : 3 + normalizedWeight * 3}
              fill={isQuery ? "#F59E0B" : `rgba(0,229,255,${0.3 + normalizedWeight * 0.7})`}
              style={{
                filter: isQuery
                  ? "drop-shadow(0 0 6px rgba(245,158,11,0.8))"
                  : normalizedWeight > 0.4
                    ? "drop-shadow(0 0 4px rgba(0,229,255,0.6))"
                    : "none",
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ─── Context Window Saturation Indicator ─────────────────────────────────────

interface ContextWindowBarProps {
  tokenCount: number;
  maxTokens: number;
}

function ContextWindowBar({ tokenCount, maxTokens }: ContextWindowBarProps) {
  const fillPercent = (tokenCount / maxTokens) * 100;
  const signalStrength = Math.max(0, 1 - (tokenCount / maxTokens) * 0.85);

  const barColor = fillPercent < 40 ? "#00E5FF" : fillPercent < 70 ? "#F59E0B" : "#ef4444";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-slate-400 uppercase tracking-widest">Context window</span>
        <span className="font-bold" style={{ color: barColor }}>
          {tokenCount} / {maxTokens} tokens
        </span>
      </div>

      <div className="h-3 bg-slate-800 rounded-full overflow-hidden relative">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${barColor}99, ${barColor})` }}
          animate={{ width: `${fillPercent}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <div className="absolute right-0 top-0 h-full w-[30%] bg-red-500/10 border-l border-red-500/20" />
        <div
          className="absolute top-0 h-full border-r border-dashed border-red-400/40"
          style={{ right: "30%" }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>Attention per token: {(signalStrength * 100).toFixed(1)}%</span>
        <span className={fillPercent > 70 ? "text-red-400" : "text-slate-500"}>
          {fillPercent > 70
            ? "attention diluted"
            : fillPercent > 40
              ? "attention spreading"
              : "focused"}
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MAX_CONTEXT_TOKENS = 20;

export function AttentionSpotlightDemo() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  const [tokenCount, setTokenCount] = useState(6);
  const [activeQueryIdx, setActiveQueryIdx] = useState(2);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isAutoCycling, setIsAutoCycling] = useState(true);

  const startAutoCycle = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setActiveQueryIdx((prev) => (prev + 1) % tokenCount);
    }, 1800);
  }, [tokenCount]);

  useEffect(() => {
    if (isAutoCycling) {
      startAutoCycle();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoCycling, startAutoCycle]);

  useEffect(() => {
    setActiveQueryIdx((prev) => Math.min(prev, tokenCount - 1));
  }, [tokenCount]);

  const tokens: Token[] = SAMPLE_TOKENS.slice(0, tokenCount).map((label, id) => ({ id, label }));
  const attentionWeights = computeAttentionWeights(activeQueryIdx, tokenCount);

  const handleSelectQuery = (idx: number) => {
    setActiveQueryIdx(idx);
    setIsAutoCycling(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <div className="my-8 flex flex-col gap-4">
      {/* Context window saturation bar */}
      <div className="rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-800 px-5 py-4">
        <ContextWindowBar tokenCount={tokenCount} maxTokens={MAX_CONTEXT_TOKENS} />
      </div>

      {/* Token bar + arc visualizer */}
      <div className="rounded-xl overflow-hidden border border-slate-800 shadow-2xl shadow-cyan-900/10 bg-slate-950 relative">
        <div className="absolute top-0 left-0 w-48 h-48 bg-cyan-500/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-48 h-48 bg-amber-500/5 blur-3xl pointer-events-none" />

        <div className="p-5 flex flex-col gap-4 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Click a token to set query position
              </span>
            </div>
            <button
              onClick={() => setIsAutoCycling((v) => !v)}
              className={`text-[10px] font-mono uppercase tracking-widest px-3 py-1 rounded border transition-all ${
                isAutoCycling
                  ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                  : "text-slate-500 border-slate-700 bg-slate-900"
              }`}
            >
              {isAutoCycling ? "auto" : "manual"}
            </button>
          </div>

          {/* Token chips */}
          <TokenBar
            tokens={tokens}
            activeQueryIdx={activeQueryIdx}
            attentionWeights={attentionWeights}
            onSelectQuery={handleSelectQuery}
            shouldReduceMotion={shouldReduceMotion}
          />

          {/* Arc visualization */}
          <AttentionArcVisualizer
            tokenCount={tokenCount}
            attentionWeights={attentionWeights}
            activeQueryIdx={activeQueryIdx}
            shouldReduceMotion={shouldReduceMotion}
          />
        </div>
      </div>

      {/* Controls + softmax breakdown */}
      <div className="rounded-xl bg-slate-950/80 backdrop-blur-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
          <svg width="32" height="32" viewBox="0 0 100 100" className="stroke-cyan-500">
            <path d="M90,10 L70,10 M90,10 L90,30" fill="none" strokeWidth="3" />
            <path d="M90,90 L70,90 M90,90 L90,70" fill="none" strokeWidth="3" />
          </svg>
        </div>

        <div className="p-5 flex flex-col gap-5 relative z-10">
          {/* Token count slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label
                htmlFor="attention-token-count"
                className="text-[10px] font-mono uppercase tracking-widest text-slate-400 flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_6px_rgba(0,229,255,0.8)]" />
                Context window size
              </label>
              <span className="text-xs font-mono font-bold text-cyan-400">{tokenCount} tokens</span>
            </div>

            <div className="relative h-5 flex items-center">
              <div className="absolute left-0 w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-300"
                  style={{ width: `${((tokenCount - 1) / (MAX_CONTEXT_TOKENS - 1)) * 100}%` }}
                />
              </div>
              <input
                id="attention-token-count"
                type="range"
                min={2}
                max={MAX_CONTEXT_TOKENS}
                value={tokenCount}
                onChange={(e) => setTokenCount(parseInt(e.target.value, 10))}
                className="w-full h-5 appearance-none bg-transparent cursor-pointer z-10
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:bg-slate-950 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-cyan-400
                  [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:rotate-45 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(0,229,255,0.5)]"
                aria-label="Adjust context window token count to see attention dilution"
              />
            </div>
          </div>

          <div className="border-t border-slate-800" />

          {/* Softmax probability breakdown */}
          <SoftmaxBars
            tokens={tokens}
            attentionWeights={attentionWeights}
            activeQueryIdx={activeQueryIdx}
            shouldReduceMotion={shouldReduceMotion}
          />

          {/* Explanation */}
          <p className="text-sm text-slate-400 font-mono leading-relaxed border-l-2 border-slate-800 pl-4">
            <span className="text-white font-medium">Attention is zero-sum.</span> The softmax
            function normalizes scores across all tokens — adding more tokens flattens the
            distribution, diluting signal from any single position. This is the fundamental limit of
            the context window.
          </p>
        </div>
      </div>
    </div>
  );
}
