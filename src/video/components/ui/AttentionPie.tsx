import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type PieSegment = {
  label: string;
  value: number;
  color: string;
};

type AttentionPieProps = {
  segments: PieSegment[];
  size?: number;
  delay?: number;
};

export function AttentionPie({ segments, size = 400, delay = 0 }: AttentionPieProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const total = segments.reduce((acc, s) => acc + s.value, 0);
  let cumulativeValue = 0;

  const radius = size / 2;
  const center = size / 2;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${center} ${center})`}>
          {segments.map((segment, index) => {
            const startPercentage = cumulativeValue / total;
            cumulativeValue += segment.value;
            const endPercentage = cumulativeValue / total;

            const progress = spring({
              frame: frame - delay - index * 5,
              fps,
              config: SPRING_CONFIGS.snappy,
            });

            if (progress <= 0) return null;

            const currentEndPercentage =
              startPercentage + (endPercentage - startPercentage) * progress;

            // Handle edge case of 100%
            const isFull = currentEndPercentage - startPercentage >= 0.9999;

            if (isFull) {
              return (
                <circle
                  key={segment.label}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill={segment.color}
                  style={{ filter: `drop-shadow(0 0 15px ${segment.color}60)` }}
                />
              );
            }

            const x1 = center + radius * Math.cos(2 * Math.PI * startPercentage);
            const y1 = center + radius * Math.sin(2 * Math.PI * startPercentage);
            const x2 = center + radius * Math.cos(2 * Math.PI * currentEndPercentage);
            const y2 = center + radius * Math.sin(2 * Math.PI * currentEndPercentage);

            const largeArcFlag = currentEndPercentage - startPercentage > 0.5 ? 1 : 0;

            const d = [
              `M ${center} ${center}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              "Z",
            ].join(" ");

            return (
              <path
                key={segment.label}
                d={d}
                fill={segment.color}
                style={{
                  filter: `drop-shadow(0 0 15px ${segment.color}60)`,
                  transition: "fill 0.3s ease",
                }}
              />
            );
          })}
        </g>
      </svg>
      {/* Inner hole for donut style */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "25%",
          width: "50%",
          height: "50%",
          backgroundColor: COLORS.darkBg,
          borderRadius: "50%",
          boxShadow: "inset 0 0 30px rgba(0,0,0,0.9)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          border: `1px solid ${COLORS.darkBorder}`,
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: 800,
            fontFamily: "Inter, sans-serif",
          }}
        >
          ATTENTION
        </div>
        <div
          style={{
            color: COLORS.cyan,
            fontSize: 16,
            fontWeight: 500,
            fontFamily: "Inter, sans-serif",
            opacity: 0.7,
          }}
        >
          CAPACITY
        </div>
      </div>
    </div>
  );
}
