import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../../core-logic/constants";

type SuccessRateChartProps = {
  delay?: number;
  /** How many bars to reveal (1-3) */
  revealCount?: number;
};

const BARS = [
  {
    label: "Single-shot",
    value: 60,
    color: COLORS.textMuted,
    sublabel: "One prompt, one try",
  },
  {
    label: "Agent Loop",
    value: 85,
    color: VERITASIUM_COLORS.generating,
    sublabel: "Up to 3 retries",
  },
  {
    label: "With Notes",
    value: 92,
    color: VERITASIUM_COLORS.learning,
    sublabel: "Learning applied",
  },
];

export const SuccessRateChart: FC<SuccessRateChartProps> = ({ delay = 0, revealCount = 3 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxHeight = 340;
  const barWidth = 140;
  const gap = 80;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: COLORS.textPrimary,
          fontFamily: "Inter, sans-serif",
          opacity: spring({
            frame: frame - delay,
            fps,
            config: SPRING_CONFIGS.smooth,
          }),
        }}
      >
        Success Rate Comparison
      </div>

      {/* Chart area */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap,
          height: maxHeight + 80,
          padding: "0 40px",
        }}
      >
        {BARS.map((bar, i) => {
          if (i >= revealCount) return null;
          const barDelay = delay + 15 + i * 15;
          const progress = spring({
            frame: frame - barDelay,
            fps,
            config: SPRING_CONFIGS.snappy,
          });
          const barHeight = (bar.value / 100) * maxHeight * progress;
          const valueOpacity = interpolate(frame, [barDelay + 20, barDelay + 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const displayValue = Math.round(bar.value * progress);

          return (
            <div
              key={bar.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Value */}
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: bar.color,
                  fontFamily: "JetBrains Mono, monospace",
                  opacity: valueOpacity,
                }}
              >
                {displayValue}%
              </div>

              {/* Bar */}
              <div
                style={{
                  width: barWidth,
                  height: barHeight,
                  borderRadius: "12px 12px 0 0",
                  background: `linear-gradient(180deg, ${bar.color}, ${bar.color}80)`,
                  boxShadow: `0 0 20px ${bar.color}30`,
                  position: "relative",
                }}
              >
                {/* Trending arrow for last bar */}
                {i === 2 && progress > 0.8 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      fontSize: 20,
                      opacity: interpolate(progress, [0.8, 1], [0, 1]),
                    }}
                  >
                    📈
                  </div>
                )}
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                }}
              >
                {bar.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                }}
              >
                {bar.sublabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
