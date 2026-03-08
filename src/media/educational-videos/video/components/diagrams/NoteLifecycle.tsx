import { type FC, Fragment } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../../core-logic/constants";

type NoteLifecycleProps = {
  /** 0-2: which stage to highlight (0=candidate, 1=active, 2=deprecated) */
  activeStage?: number;
  /** Number of stages to show (1-3) */
  revealCount?: number;
  delay?: number;
};

const STAGES = [
  {
    label: "CANDIDATE",
    color: VERITASIUM_COLORS.candidate,
    desc: "New & unproven",
    icon: "🌱",
  },
  {
    label: "ACTIVE",
    color: VERITASIUM_COLORS.active,
    desc: "3+ helps, >60% confidence",
    icon: "✅",
  },
  {
    label: "DEPRECATED",
    color: VERITASIUM_COLORS.deprecated,
    desc: "<30% confidence",
    icon: "📦",
  },
];

export const NoteLifecycle: FC<NoteLifecycleProps> = ({
  activeStage = -1,
  revealCount = 3,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        justifyContent: "center",
      }}
    >
      {STAGES.map((stage, i) => {
        if (i >= revealCount) return null;
        const stageDelay = delay + i * 20;
        const progress = spring({
          frame: frame - stageDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });
        const isActive = i === activeStage;
        const glowAmount = isActive ? 16 + Math.sin(frame / 8) * 8 : 0;

        return (
          <Fragment key={stage.label}>
            {/* Node */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                transform: `scale(${progress})`,
                opacity: interpolate(progress, [0, 1], [0, 1]),
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: isActive ? `${stage.color}25` : `${stage.color}10`,
                  border: `3px solid ${stage.color}${isActive ? "ff" : "50"}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isActive
                    ? `0 0 ${glowAmount}px ${stage.color}50`
                    : "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                <span style={{ fontSize: 32 }}>{stage.icon}</span>
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: stage.color,
                  fontFamily: "JetBrains Mono, monospace",
                  letterSpacing: "0.05em",
                }}
              >
                {stage.label}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: COLORS.textMuted,
                  fontFamily: "Inter, sans-serif",
                  textAlign: "center",
                  maxWidth: 140,
                }}
              >
                {stage.desc}
              </div>
            </div>

            {/* Arrow between nodes */}
            {i < revealCount - 1 && i < 2 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  margin: "0 24px",
                  marginBottom: 60,
                  opacity: spring({
                    frame: frame - stageDelay - 15,
                    fps,
                    config: SPRING_CONFIGS.smooth,
                  }),
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 2,
                    background: `linear-gradient(90deg, ${
                      STAGES[i]!.color
                    }60, ${STAGES[i + 1]!.color}60)`,
                  }}
                />
                <div
                  style={{
                    width: 0,
                    height: 0,
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    borderLeft: `12px solid ${STAGES[i + 1]!.color}60`,
                  }}
                />
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
};
