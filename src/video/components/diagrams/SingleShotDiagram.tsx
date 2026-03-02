import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type SingleShotDiagramProps = {
  delay?: number;
  /** How many of the 10 attempts to show (animated reveal) */
  attemptCount?: number;
};

export const SingleShotDiagram: FC<SingleShotDiagramProps> = ({ delay = 0, attemptCount = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 6 successes, 4 failures (60% success rate)
  const results: boolean[] = [true, true, false, true, false, true, true, false, false, true];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 40,
      }}
    >
      {/* Flow: Prompt -> AI -> Results */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          opacity: spring({
            frame: frame - delay,
            fps,
            config: SPRING_CONFIGS.smooth,
          }),
        }}
      >
        {/* Prompt box */}
        <div
          style={{
            padding: "16px 28px",
            borderRadius: 12,
            background: `${COLORS.purple}20`,
            border: `2px solid ${COLORS.purple}60`,
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.purple,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Prompt
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 40, height: 2, background: COLORS.textMuted }} />
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: `10px solid ${COLORS.textMuted}`,
            }}
          />
        </div>

        {/* AI box */}
        <div
          style={{
            padding: "16px 28px",
            borderRadius: 12,
            background: `${COLORS.cyan}20`,
            border: `2px solid ${COLORS.cyan}60`,
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.cyan,
            fontFamily: "Inter, sans-serif",
          }}
        >
          AI Model
        </div>

        {/* Arrow */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 40, height: 2, background: COLORS.textMuted }} />
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderLeft: `10px solid ${COLORS.textMuted}`,
            }}
          />
        </div>

        {/* Code box */}
        <div
          style={{
            padding: "16px 28px",
            borderRadius: 12,
            background: `rgba(255,255,255,0.05)`,
            border: `2px solid ${COLORS.darkBorder}`,
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.textSecondary,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Code
        </div>
      </div>

      {/* Results grid */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 600,
        }}
      >
        {results.slice(0, attemptCount).map((success, i) => {
          const itemDelay = delay + 20 + i * 6;
          const progress = spring({
            frame: frame - itemDelay,
            fps,
            config: SPRING_CONFIGS.snappy,
          });
          const color = success ? COLORS.success : COLORS.error;
          const icon = success ? "✓" : "✗";

          return (
            <div
              key={i}
              style={{
                width: 80,
                height: 80,
                borderRadius: 12,
                background: `${color}15`,
                border: `2px solid ${color}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
                fontWeight: 700,
                color: color,
                transform: `scale(${progress})`,
                boxShadow: `0 4px 12px ${color}20`,
              }}
            >
              {icon}
            </div>
          );
        })}
      </div>

      {/* Failure explanation */}
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "center",
          opacity: interpolate(frame, [delay + 80, delay + 100], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: COLORS.success,
            }}
          />
          <span
            style={{
              fontSize: 14,
              color: COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Success (~60%)
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: COLORS.error,
            }}
          />
          <span
            style={{
              fontSize: 14,
              color: COLORS.textSecondary,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Failure → Trash
          </span>
        </div>
      </div>
    </div>
  );
};
