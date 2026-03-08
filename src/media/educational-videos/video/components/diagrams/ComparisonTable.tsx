import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";
import { stagger } from "../../lib/animations";
import { GlassmorphismCard } from "../ui/GlassmorphismCard";

type ComparisonRow = {
  label: string;
  before: string;
  after: string;
};

type ComparisonTableProps = {
  delay?: number;
  rows?: ComparisonRow[];
};

const DEFAULT_ROWS: ComparisonRow[] = [
  { label: "Success Rate", before: "40%", after: "65%" },
  { label: "With Retries", before: "55%", after: "85%" },
  { label: "Memory", before: "None", after: "Bayesian" },
  { label: "Cost", before: "$0.005", after: "$0.10" },
  { label: "Value", before: "Low", after: "High" },
];

export const ComparisonTable: FC<ComparisonTableProps> = ({ delay = 0, rows = DEFAULT_ROWS }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  return (
    <GlassmorphismCard width={700} delay={delay} color={COLORS.cyan}>
      {/* Title */}
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          marginBottom: 24,
          opacity: headerProgress,
        }}
      >
        Before vs After
      </div>

      {/* Column headers */}
      <div
        style={{
          display: "flex",
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${COLORS.darkBorder}`,
          opacity: headerProgress,
        }}
      >
        <div
          style={{
            flex: 1.2,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textMuted,
            fontFamily: "Inter, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Metric
        </div>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textMuted,
            fontFamily: "Inter, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
          }}
        >
          Before
        </div>
        <div
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.cyan,
            fontFamily: "Inter, sans-serif",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            textAlign: "center",
          }}
        >
          After
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => {
        const rowDelay = delay + 15 + stagger(i, 10);
        const rowProgress = spring({
          frame: frame - rowDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });
        const slideX = interpolate(rowProgress, [0, 1], [40, 0]);
        const afterGlow = interpolate(rowProgress, [0.6, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 0",
              opacity: rowProgress,
              transform: `translateX(${slideX}px)`,
              borderBottom: i < rows.length - 1 ? `1px solid ${COLORS.darkBorder}40` : "none",
            }}
          >
            {/* Label */}
            <div
              style={{
                flex: 1.2,
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.textPrimary,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {row.label}
            </div>

            {/* Before value */}
            <div
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 500,
                color: COLORS.error,
                fontFamily: "JetBrains Mono, monospace",
                textAlign: "center",
                opacity: 0.7,
              }}
            >
              {row.before}
            </div>

            {/* After value */}
            <div
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: 700,
                color: COLORS.cyan,
                fontFamily: "JetBrains Mono, monospace",
                textAlign: "center",
                textShadow: `0 0 ${8 * afterGlow}px ${COLORS.cyan}60`,
              }}
            >
              {row.after}
            </div>
          </div>
        );
      })}
    </GlassmorphismCard>
  );
};
