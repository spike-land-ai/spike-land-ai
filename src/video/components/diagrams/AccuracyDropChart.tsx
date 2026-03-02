import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type AccuracyDropChartProps = {
  delay?: number;
};

const BARS = [
  { label: "1K tokens", value: 95.2, color: COLORS.success },
  { label: "30K tokens", value: 47.6, color: COLORS.amber },
];

export const AccuracyDropChart: FC<AccuracyDropChartProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const maxHeight = 280;
  const barWidth = 160;

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
          opacity: titleProgress,
        }}
      >
        Accuracy vs Context Length
      </div>

      {/* Chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 80,
          height: maxHeight + 80,
        }}
      >
        {BARS.map((bar, i) => {
          const barDelay = delay + 12 + i * 18;
          const progress = spring({
            frame: frame - barDelay,
            fps,
            config: SPRING_CONFIGS.snappy,
            durationInFrames: 24,
          });
          const barHeight = (bar.value / 100) * maxHeight * progress;
          const valueOpacity = interpolate(frame, [barDelay + 18, barDelay + 28], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const displayValue = (bar.value * progress).toFixed(1);

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
              {/* Percentage label */}
              <div
                style={{
                  fontSize: 42,
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
                {/* Warning indicator on second bar */}
                {i === 1 && progress > 0.8 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: `${COLORS.error}30`,
                      border: `2px solid ${COLORS.error}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 800,
                      color: COLORS.error,
                      opacity: interpolate(progress, [0.8, 1], [0, 1]),
                    }}
                  >
                    !
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
                }}
              >
                {bar.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.error,
          fontFamily: "Inter, sans-serif",
          opacity: interpolate(frame, [delay + 50, delay + 65], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Accuracy drops 47.6% at 30K tokens
      </div>
    </div>
  );
};
