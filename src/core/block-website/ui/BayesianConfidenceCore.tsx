import { type FC, useId } from "react";

const clamp = (val: number, min: number, max: number): number => Math.min(Math.max(val, min), max);

const COLORS = {
  cyan: "#00E5FF",
  darkBg: "transparent",
  darkBorder: "hsl(var(--border))",
  textPrimary: "hsl(var(--foreground))",
  textSecondary: "hsl(var(--muted-foreground))",
  textMuted: "hsl(var(--muted-foreground))",
} as const;

export type EvidenceType = "positive" | "negative" | "neutral";

export type EvidencePoint = {
  id: string;
  type: EvidenceType;
  value: number;
};

export type BayesianConfidenceCoreProps = {
  successes: number;
  failures: number;
  neutrals: number;
  evidencePoints: EvidencePoint[];
  width?: number;
  height?: number;
  className?: string;
  progress?: number;
  style?: React.CSSProperties;
  flashActive?: boolean;
};

// Simple approximation of beta distribution PDF
function betaPdf(x: number, alpha: number, beta: number): number {
  if (x === 0 || x === 1) return 0;
  const maxVal =
    Math.pow((alpha - 1) / (alpha + beta - 2), alpha - 1) *
    Math.pow((beta - 1) / (alpha + beta - 2), beta - 1);
  const val = Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1);
  return maxVal > 0 ? val / maxVal : val;
}

export const BayesianConfidenceCore: FC<BayesianConfidenceCoreProps> = ({
  successes,
  failures,
  neutrals,
  evidencePoints: _evidencePoints,
  width = 1920,
  height = 1080,
  className,
  progress = 1,
  style,
  flashActive: _flashActive = false,
}) => {
  const id = useId();

  const alpha = 2 + successes;
  const beta = 2 + failures;
  const total = successes + failures + neutrals;
  const mean = alpha / (alpha + beta);

  const graphWidth = 1400;
  const graphHeight = 620;
  const startX = (width - graphWidth) / 2;
  const baseY = height / 2 + 220;
  const introScale = clamp(progress * 2, 0, 1);

  const segments = 120;
  const points: string[] = [];

  for (let i = 0; i <= segments; i++) {
    const x = i / segments;
    let yVal = 0;
    if (alpha === 2 && beta === 2) {
      yVal = 4 * x * (1 - x);
    } else {
      yVal = betaPdf(x, alpha, beta);
    }

    const clampedY = clamp(yVal, 0, 1.2) * graphHeight * 0.8;

    points.push(`${startX + x * graphWidth},${baseY - clampedY * introScale}`);
  }

  const pathData = `M ${startX},${baseY} L ${points.join(" L ")} L ${
    startX + graphWidth
  },${baseY} Z`;
  const meanX = startX + mean * graphWidth;

  const isHighConfidence = mean > 0.7;
  const isLowConfidence = mean < 0.4 && total > 2;
  const themeColor = isHighConfidence ? "#10b981" : isLowConfidence ? "#ef4444" : "#3b82f6";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: COLORS.darkBg,
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      <defs>
        <pattern id={`grid-${id}`} x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke={COLORS.textMuted} strokeOpacity={0.05} />
        </pattern>

        <linearGradient id={`curveGrad-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={themeColor} stopOpacity="0.6" />
          <stop offset="100%" stopColor={themeColor} stopOpacity="0" />
        </linearGradient>

        <filter id={`glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={`strongGlow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="30" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="100%" height="100%" fill={`url(#grid-${id})`} />

      <g opacity={Math.min(1, progress * 2)}>
        <line
          x1={startX - 40}
          y1={baseY}
          x2={startX + graphWidth + 40}
          y2={baseY}
          stroke={COLORS.textMuted}
          strokeWidth={2}
          opacity={0.5}
        />

        {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
          <g key={`tick-${tick}`} transform={`translate(${startX + tick * graphWidth}, ${baseY})`}>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={10}
              stroke={COLORS.textMuted}
              strokeWidth={2}
              opacity={0.5}
            />
            <text
              y={25}
              textAnchor="middle"
              fill={COLORS.textMuted}
              fontSize={14}
              fontFamily="JetBrains Mono, monospace"
            >
              {tick * 100}%
            </text>
          </g>
        ))}

        <path
          d={pathData}
          fill={`url(#curveGrad-${id})`}
          stroke={themeColor}
          strokeWidth={4}
          filter={`url(#glow-${id})`}
          style={{ transition: "all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        />

        <g
          transform={`translate(${meanX}, ${baseY})`}
          style={{ transition: "all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={-graphHeight}
            stroke={themeColor}
            strokeWidth={2}
            strokeDasharray="8 8"
            opacity={0.8}
          />
          <polygon points="-10,0 10,0 0,-15" fill={themeColor} />

          <g transform={`translate(0, -${graphHeight + 50})`}>
            <rect
              x={-60}
              y={-30}
              width={120}
              height={40}
              rx={4}
              fill="hsl(var(--muted) / 0.8)"
              stroke={themeColor}
              strokeWidth={1}
              filter={`url(#glow-${id})`}
            />
            <text
              x={0}
              y={-5}
              textAnchor="middle"
              fill={COLORS.textPrimary}
              fontSize={18}
              fontWeight="bold"
              fontFamily="JetBrains Mono, monospace"
            >
              {(mean * 100).toFixed(1)}%
            </text>
            <text
              x={0}
              y={25}
              textAnchor="middle"
              fill={themeColor}
              fontSize={12}
              fontWeight="bold"
              letterSpacing={2}
              className="uppercase font-mono"
            >
              Expected
            </text>
          </g>
        </g>

        <g transform="translate(160, 160)">
          <rect
            x={0}
            y={0}
            width={300}
            height={160}
            rx={8}
            fill="hsl(var(--muted) / 0.7)"
            stroke={COLORS.darkBorder}
            strokeWidth={1}
          />
          <text
            x={30}
            y={40}
            fill={COLORS.textPrimary}
            fontSize={28}
            fontWeight={800}
            letterSpacing={2}
          >
            TRIAL METRICS
          </text>

          <text
            x={30}
            y={80}
            fill={COLORS.textMuted}
            fontSize={14}
            fontFamily="JetBrains Mono, monospace"
            className="uppercase"
          >
            SUCCESSES
          </text>
          <text
            x={270}
            y={80}
            fill="#10b981"
            fontSize={24}
            fontWeight="bold"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {successes}
          </text>

          <text
            x={30}
            y={120}
            fill={COLORS.textMuted}
            fontSize={14}
            fontFamily="JetBrains Mono, monospace"
            className="uppercase"
          >
            FAILURES
          </text>
          <text
            x={270}
            y={120}
            fill="#ef4444"
            fontSize={24}
            fontWeight="bold"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {failures}
          </text>

          <line
            x1={30}
            y1={140}
            x2={270}
            y2={140}
            stroke={COLORS.textMuted}
            strokeWidth={1}
            opacity={0.2}
          />
          <text
            x={30}
            y={170}
            fill={COLORS.cyan}
            fontSize={14}
            fontFamily="JetBrains Mono, monospace"
            className="uppercase"
          >
            OBSERVED P(θ)
          </text>
          <text
            x={270}
            y={170}
            fill={COLORS.cyan}
            fontSize={18}
            fontWeight="bold"
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
          >
            {total > 0 ? (successes / total).toFixed(3) : "0.000"}
          </text>
        </g>

        <g transform="translate(1460, 160)">
          <path
            d="M 0 0 L 30 0 L 40 10 L 40 40 L 0 40 Z"
            fill="none"
            stroke={COLORS.textMuted}
            strokeOpacity={0.3}
          />
          <text
            x={15}
            y={25}
            fill={COLORS.textMuted}
            fontSize={12}
            fontFamily="JetBrains Mono, monospace"
          >
            0xBETA
          </text>
          <text
            x={0}
            y={70}
            fill={COLORS.textSecondary}
            fontSize={14}
            fontFamily="Inter, sans-serif"
          >
            Bayesian updating shifts the
          </text>
          <text
            x={0}
            y={95}
            fill={COLORS.textSecondary}
            fontSize={14}
            fontFamily="Inter, sans-serif"
          >
            probability distribution as
          </text>
          <text
            x={0}
            y={120}
            fill={COLORS.textSecondary}
            fontSize={14}
            fontFamily="Inter, sans-serif"
          >
            evidence accumulates.
          </text>
        </g>
      </g>
    </svg>
  );
};
