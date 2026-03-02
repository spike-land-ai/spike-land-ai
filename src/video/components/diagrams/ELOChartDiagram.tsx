import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { barGrow, fadeIn } from "../../lib/animations";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY, VERITASIUM_COLORS } from "../../lib/constants";

type ELOChartDiagramProps = {
  delay?: number;
};

const REVIEWERS = [
  {
    name: "Plan Reviewer",
    elo: 1650,
    color: VERITASIUM_COLORS.planning,
    trend: "up" as const,
  },
  {
    name: "Code Reviewer",
    elo: 1420,
    color: COLORS.amber,
    trend: "down" as const,
  },
];

export function ELOChartDiagram({ delay = 0 }: ELOChartDiagramProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const maxElo = 2000;
  const barMaxHeight = 300;

  // Formula reveal
  const formulaOpacity = fadeIn(frame, fps, 0.6, delay + 30);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
        width: 700,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: TYPOGRAPHY.fontSize["2xl"],
          fontWeight: 700,
          color: COLORS.textPrimary,
          fontFamily: TYPOGRAPHY.fontFamily.sans,
          opacity: fadeIn(frame, fps, 0.4, delay),
        }}
      >
        ELO Reviewer Rankings
      </div>

      {/* Bars */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 80,
          height: barMaxHeight + 60,
        }}
      >
        {REVIEWERS.map((reviewer, index) => {
          const itemDelay = delay + index * 12;
          const height = barGrow(frame, fps, (reviewer.elo / maxElo) * barMaxHeight, itemDelay);
          const labelProgress = spring({
            frame: frame - itemDelay - 15,
            fps,
            config: SPRING_CONFIGS.snappy,
          });

          // Animate the ELO number counting up
          const eloValue = Math.round(
            interpolate(
              spring({
                frame: frame - itemDelay,
                fps,
                config: SPRING_CONFIGS.smooth,
                durationInFrames: 30,
              }),
              [0, 1],
              [1000, reviewer.elo],
            ),
          );

          const trendArrow = reviewer.trend === "up" ? "\u2191" : "\u2193";
          const trendColor = reviewer.trend === "up" ? COLORS.success : COLORS.error;

          return (
            <div
              key={reviewer.name}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              {/* ELO Score */}
              <div
                style={{
                  fontSize: TYPOGRAPHY.fontSize["3xl"],
                  fontWeight: 700,
                  color: reviewer.color,
                  fontFamily: TYPOGRAPHY.fontFamily.mono,
                  opacity: labelProgress,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {eloValue}
                <span
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.xl,
                    color: trendColor,
                  }}
                >
                  {trendArrow}
                </span>
              </div>

              {/* Bar */}
              <div
                style={{
                  width: 100,
                  height,
                  backgroundColor: reviewer.color,
                  borderRadius: "12px 12px 0 0",
                  boxShadow: `0 0 30px ${reviewer.color}40`,
                  position: "relative",
                }}
              >
                {/* Gradient overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "12px 12px 0 0",
                    background: `linear-gradient(180deg, ${reviewer.color}00 0%, ${reviewer.color}40 100%)`,
                  }}
                />
              </div>

              {/* Label */}
              <div
                style={{
                  fontSize: TYPOGRAPHY.fontSize.base,
                  fontWeight: 600,
                  color: COLORS.textSecondary,
                  fontFamily: TYPOGRAPHY.fontFamily.sans,
                  opacity: labelProgress,
                  textAlign: "center",
                }}
              >
                {reviewer.name}
              </div>
            </div>
          );
        })}
      </div>

      {/* Softmax Formula */}
      <div
        style={{
          opacity: formulaOpacity,
          padding: "16px 32px",
          background: `${COLORS.darkCard}`,
          border: `1px solid ${COLORS.darkBorder}`,
          borderRadius: 12,
        }}
      >
        <div
          style={{
            fontSize: TYPOGRAPHY.fontSize.lg,
            color: VERITASIUM_COLORS.bayesian,
            fontFamily: TYPOGRAPHY.fontFamily.mono,
            textAlign: "center",
          }}
        >
          {"p(i) = e^(ELO_i / 400) / \u03A3 e^(ELO_j / 400)"}
        </div>
      </div>
    </div>
  );
}
