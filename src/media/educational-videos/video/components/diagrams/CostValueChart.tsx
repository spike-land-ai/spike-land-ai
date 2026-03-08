import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";

type CostValueChartProps = {
  delay?: number;
};

export const CostValueChart: FC<CostValueChartProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const maxHeight = 300;
  const barWidth = 140;

  // Cost bar: shorter (represents cost increase, ~30% height)
  const costDelay = delay + 12;
  const costProgress = spring({
    frame: frame - costDelay,
    fps,
    config: SPRING_CONFIGS.snappy,
    durationInFrames: 24,
  });
  const costHeight = 0.3 * maxHeight * costProgress;

  // Value bar: much taller (~90% height)
  const valueDelay = delay + 24;
  const valueProgress = spring({
    frame: frame - valueDelay,
    fps,
    config: SPRING_CONFIGS.snappy,
    durationInFrames: 24,
  });
  const valueHeight = 0.9 * maxHeight * valueProgress;

  const costLabelOpacity = interpolate(frame, [costDelay + 18, costDelay + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const valueLabelOpacity = interpolate(frame, [valueDelay + 18, valueDelay + 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const annotationOpacity = interpolate(frame, [delay + 55, delay + 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
        Cost vs Value
      </div>

      {/* Chart */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 80,
          height: maxHeight + 60,
        }}
      >
        {/* Cost bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.amber,
              fontFamily: "JetBrains Mono, monospace",
              opacity: costLabelOpacity,
            }}
          >
            15-20x
          </div>
          <div
            style={{
              width: barWidth,
              height: costHeight,
              borderRadius: "12px 12px 0 0",
              background: `linear-gradient(180deg, ${COLORS.amber}, ${COLORS.amber}80)`,
              boxShadow: `0 0 20px ${COLORS.amber}30`,
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
              textAlign: "center",
            }}
          >
            Cost
          </div>
          <div
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              fontFamily: "Inter, sans-serif",
              opacity: costLabelOpacity,
            }}
          >
            15-20x more expensive
          </div>
        </div>

        {/* Value bar */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: COLORS.success,
              fontFamily: "JetBrains Mono, monospace",
              opacity: valueLabelOpacity,
            }}
          >
            Working Apps
          </div>
          <div
            style={{
              width: barWidth,
              height: valueHeight,
              borderRadius: "12px 12px 0 0",
              background: `linear-gradient(180deg, ${COLORS.success}, ${COLORS.success}80)`,
              boxShadow: `0 0 24px ${COLORS.success}30`,
            }}
          />
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
              textAlign: "center",
            }}
          >
            Value
          </div>
          <div
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              fontFamily: "Inter, sans-serif",
              opacity: valueLabelOpacity,
            }}
          >
            Working apps
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: COLORS.success,
          fontFamily: "Inter, sans-serif",
          opacity: annotationOpacity,
          marginTop: 8,
        }}
      >
        $0.10 that works &gt; $0.005 that&apos;s broken
      </div>
    </div>
  );
};
