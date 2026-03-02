import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type BarChartProps = {
  data: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  maxValue: number;
  height?: number;
  barWidth?: number;
  gap?: number;
  delay?: number;
  showLabels?: boolean;
  showValues?: boolean;
};

export function BarChart({
  data,
  maxValue,
  height = 200,
  barWidth = 60,
  gap = 20,
  delay = 0,
  showLabels = true,
  showValues = true,
}: BarChartProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: `${gap}px`,
        height: `${height}px`,
      }}
    >
      {data.map((item, index) => {
        const itemDelay = delay + index * 8;
        const progress = spring({
          frame: frame - itemDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });

        const barHeight = (item.value / maxValue) * height * progress;
        const valueOpacity = interpolate(frame, [itemDelay + 15, itemDelay + 25], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={item.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {showValues && (
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: item.color,
                  opacity: valueOpacity,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {Math.round(item.value * progress)}%
              </div>
            )}
            <div
              style={{
                width: `${barWidth}px`,
                height: `${barHeight}px`,
                backgroundColor: item.color,
                borderRadius: "8px 8px 0 0",
                boxShadow: `0 0 20px ${item.color}40`,
              }}
            />
            {showLabels && (
              <div
                style={{
                  fontSize: 14,
                  color: COLORS.textSecondary,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {item.label}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
