import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../../core-logic/constants";

type NoteStatus = "CANDIDATE" | "ACTIVE" | "DEPRECATED";

type LearningNoteCardProps = {
  pattern: string;
  solution: string;
  confidence: number;
  status: NoteStatus;
  timesApplied: number;
  delay?: number;
  showGlow?: boolean;
};

const STATUS_COLORS: Record<NoteStatus, string> = {
  CANDIDATE: VERITASIUM_COLORS.candidate,
  ACTIVE: VERITASIUM_COLORS.active,
  DEPRECATED: VERITASIUM_COLORS.deprecated,
};

export const LearningNoteCard: FC<LearningNoteCardProps> = ({
  pattern,
  solution,
  confidence,
  status,
  timesApplied,
  delay = 0,
  showGlow = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });
  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const y = interpolate(progress, [0, 1], [30, 0]);
  const statusColor = STATUS_COLORS[status];
  const glowIntensity = showGlow ? 8 + Math.sin(frame / 12) * 4 : 0;

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background: "rgba(255, 255, 255, 0.04)",
        backdropFilter: "blur(12px)",
        borderRadius: 16,
        border: `1px solid ${statusColor}50`,
        padding: 28,
        fontFamily: "JetBrains Mono, monospace",
        maxWidth: 600,
        boxShadow: showGlow
          ? `0 0 ${glowIntensity}px ${statusColor}30, 0 8px 32px rgba(0,0,0,0.4)`
          : "0 8px 32px rgba(0,0,0,0.4)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Status badge */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          background: `${statusColor}20`,
          border: `1px solid ${statusColor}60`,
          borderRadius: 20,
          padding: "4px 14px",
          fontSize: 12,
          fontWeight: 700,
          color: statusColor,
          letterSpacing: "0.05em",
        }}
      >
        {status}
      </div>

      {/* Pattern */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Pattern
        </div>
        <div style={{ fontSize: 16, color: COLORS.error, fontWeight: 600 }}>
          &quot;{pattern}&quot;
        </div>
      </div>

      {/* Solution */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            color: COLORS.textMuted,
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Solution
        </div>
        <div
          style={{
            fontSize: 16,
            color: VERITASIUM_COLORS.learning,
            fontWeight: 600,
          }}
        >
          &quot;{solution}&quot;
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Confidence
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: VERITASIUM_COLORS.bayesian,
              marginTop: 2,
            }}
          >
            {(confidence * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted }}>Bayesian</div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              color: COLORS.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            Times Applied
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.textPrimary,
              marginTop: 2,
            }}
          >
            {timesApplied}
          </div>
        </div>
      </div>
    </div>
  );
};
