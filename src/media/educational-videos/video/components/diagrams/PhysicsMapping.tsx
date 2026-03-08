import { type FC, Fragment } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../../core-logic/constants";
import { stagger } from "../../lib/animations";

type PhysicsMappingProps = {
  delay?: number;
  /** How many rows to reveal (1-5) */
  revealCount?: number;
};

const MAPPINGS = [
  { physics: "Conservation Law", code: "Identity Layer" },
  { physics: "Measurement", code: "Knowledge" },
  { physics: "Calibration", code: "Examples" },
  { physics: "Boundary Conditions", code: "Constraints" },
  { physics: "Observables", code: "Tools" },
];

const COLUMN_LEFT_X = 280;
const COLUMN_RIGHT_X = 720;
const ROW_START_Y = 60;
const ROW_GAP = 80;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 48;

export const PhysicsMapping: FC<PhysicsMappingProps> = ({ delay = 0, revealCount = 5 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        position: "relative",
        width: 1000,
        height: ROW_START_Y + MAPPINGS.length * ROW_GAP + 20,
      }}
    >
      {/* Column headers */}
      <div
        style={{
          position: "absolute",
          left: COLUMN_LEFT_X - CARD_WIDTH / 2,
          top: 0,
          width: CARD_WIDTH,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: COLORS.textMuted,
          fontFamily: "JetBrains Mono, monospace",
          textTransform: "uppercase",
          opacity: spring({
            frame: frame - delay,
            fps,
            config: SPRING_CONFIGS.smooth,
          }),
        }}
      >
        Physics
      </div>
      <div
        style={{
          position: "absolute",
          left: COLUMN_RIGHT_X - CARD_WIDTH / 2,
          top: 0,
          width: CARD_WIDTH,
          textAlign: "center",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 1.5,
          color: COLORS.textMuted,
          fontFamily: "JetBrains Mono, monospace",
          textTransform: "uppercase",
          opacity: spring({
            frame: frame - delay,
            fps,
            config: SPRING_CONFIGS.smooth,
          }),
        }}
      >
        Code
      </div>

      {/* SVG connecting lines */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
        }}
      >
        {MAPPINGS.map((_, i) => {
          if (i >= revealCount) return null;
          const rowY = ROW_START_Y + (i + 1) * ROW_GAP - ROW_GAP / 2 + CARD_HEIGHT / 2;
          const lineDelay = delay + stagger(i, 8) + 10;
          const lineProgress = interpolate(frame, [lineDelay, lineDelay + 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });

          const x1 = COLUMN_LEFT_X + CARD_WIDTH / 2 + 4;
          const x2 = COLUMN_RIGHT_X - CARD_WIDTH / 2 - 4;
          const visibleX2 = x1 + (x2 - x1) * lineProgress;

          return (
            <g key={`line-${i}`}>
              {/* Glow */}
              <line
                x1={x1}
                y1={rowY}
                x2={visibleX2}
                y2={rowY}
                stroke={COLORS.cyan}
                strokeWidth={4}
                strokeLinecap="round"
                opacity={0.3 * lineProgress}
                filter="url(#lineGlow)"
              />
              {/* Main line */}
              <line
                x1={x1}
                y1={rowY}
                x2={visibleX2}
                y2={rowY}
                stroke={COLORS.cyan}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={lineProgress}
              />
            </g>
          );
        })}
        <defs>
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Term cards */}
      {MAPPINGS.map((mapping, i) => {
        if (i >= revealCount) return null;
        const rowDelay = delay + stagger(i, 8);
        const progress = spring({
          frame: frame - rowDelay,
          fps,
          config: SPRING_CONFIGS.snappy,
        });
        const rowY = ROW_START_Y + (i + 1) * ROW_GAP - ROW_GAP / 2;

        return (
          <Fragment key={mapping.physics}>
            {/* Physics term (left) */}
            <div
              style={{
                position: "absolute",
                left: COLUMN_LEFT_X - CARD_WIDTH / 2,
                top: rowY,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                borderRadius: 12,
                background: `${COLORS.purple}15`,
                border: `1px solid ${COLORS.purple}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.purple,
                fontFamily: "Inter, sans-serif",
                opacity: progress,
                transform: `translateX(${(1 - progress) * -40}px)`,
              }}
            >
              {mapping.physics}
            </div>

            {/* Code term (right) */}
            <div
              style={{
                position: "absolute",
                left: COLUMN_RIGHT_X - CARD_WIDTH / 2,
                top: rowY,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                borderRadius: 12,
                background: `${COLORS.cyan}15`,
                border: `1px solid ${COLORS.cyan}50`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.cyan,
                fontFamily: "Inter, sans-serif",
                opacity: progress,
                transform: `translateX(${(1 - progress) * 40}px)`,
              }}
            >
              {mapping.code}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};
