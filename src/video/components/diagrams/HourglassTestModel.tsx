import { type FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { stagger } from "../../lib/animations";

type HourglassTestModelProps = {
  delay?: number;
};

const BARS = [
  { label: "MCP Tool Tests \u2014 70%", width: 70, color: COLORS.cyan },
  { label: "UI Tests \u2014 10%", width: 10, color: COLORS.amber },
  { label: "E2E Tests \u2014 20%", width: 20, color: COLORS.purple },
];

export const HourglassTestModel: FC<HourglassTestModelProps> = ({ delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        width: "100%",
        maxWidth: 800,
        padding: "0 40px",
      }}
    >
      <div
        style={{
          fontSize: TYPOGRAPHY.fontSize["2xl"],
          fontWeight: 700,
          color: COLORS.textPrimary,
          fontFamily: TYPOGRAPHY.fontFamily.sans,
          textAlign: "center",
          marginBottom: 8,
          opacity: spring({
            frame: frame - delay,
            fps,
            config: SPRING_CONFIGS.smooth,
          }),
        }}
      >
        Test Distribution
      </div>
      {BARS.map((bar, index) => {
        const barDelay = delay + stagger(index, 12);
        const progress = spring({
          frame: frame - barDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });

        return (
          <div key={bar.label} style={{ opacity: progress }}>
            <div
              style={{
                fontSize: TYPOGRAPHY.fontSize.sm,
                color: bar.color,
                fontFamily: TYPOGRAPHY.fontFamily.sans,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              {bar.label}
            </div>
            <div
              style={{
                height: 32,
                borderRadius: 8,
                background: `${bar.color}15`,
                border: `1px solid ${bar.color}30`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${bar.width * progress}%`,
                  backgroundColor: bar.color,
                  borderRadius: 8,
                  boxShadow: `0 0 16px ${bar.color}40`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
