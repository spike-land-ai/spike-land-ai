import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";
import { pulse } from "../../lib/animations";

type ImpedanceMatchingAnalogyProps = {
  /** When true, source and load are matched (power flows) */
  matched?: boolean;
  delay?: number;
};

const BOX_W = 200;
const BOX_H = 100;
const CENTER_Y = 160;
const LEFT_X = 120;
const RIGHT_X = 580;
const CONNECTION_Y = CENTER_Y + BOX_H / 2;
const DOT_COUNT = 8;

export const ImpedanceMatchingAnalogy: FC<ImpedanceMatchingAnalogyProps> = ({
  matched = true,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = spring({
    frame: frame - delay,
    fps,
    config: SPRING_CONFIGS.snappy,
  });

  const glowIntensity = pulse(frame, fps, 1.5);
  const statusColor = matched ? COLORS.success : COLORS.error;

  return (
    <div style={{ position: "relative", width: 900, height: 380 }}>
      {/* Source box */}
      <div
        style={{
          position: "absolute",
          left: LEFT_X,
          top: CENTER_Y,
          width: BOX_W,
          height: BOX_H,
          borderRadius: 16,
          background: `${COLORS.purple}15`,
          border: `2px solid ${COLORS.purple}60`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: entryProgress,
          transform: `translateX(${(1 - entryProgress) * -40}px)`,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.purple,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Source
        </div>
        <div
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            fontFamily: "Inter, sans-serif",
          }}
        >
          (Prompt)
        </div>
      </div>

      {/* Load box */}
      <div
        style={{
          position: "absolute",
          left: RIGHT_X,
          top: CENTER_Y,
          width: BOX_W,
          height: BOX_H,
          borderRadius: 16,
          background: `${COLORS.cyan}15`,
          border: `2px solid ${COLORS.cyan}60`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: entryProgress,
          transform: `translateX(${(1 - entryProgress) * 40}px)`,
        }}
      >
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: COLORS.cyan,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Load
        </div>
        <div
          style={{
            fontSize: 13,
            color: COLORS.textMuted,
            fontFamily: "Inter, sans-serif",
          }}
        >
          (Task)
        </div>
      </div>

      {/* Connection SVG */}
      <svg
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="impGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Circuit-style connection - top wire */}
        <line
          x1={LEFT_X + BOX_W}
          y1={CENTER_Y + 30}
          x2={RIGHT_X}
          y2={CENTER_Y + 30}
          stroke={statusColor}
          strokeWidth={2}
          opacity={entryProgress * 0.6}
        />
        {/* Bottom wire */}
        <line
          x1={LEFT_X + BOX_W}
          y1={CENTER_Y + BOX_H - 30}
          x2={RIGHT_X}
          y2={CENTER_Y + BOX_H - 30}
          stroke={statusColor}
          strokeWidth={2}
          opacity={entryProgress * 0.6}
        />

        {/* Center glow zone */}
        {matched && (
          <ellipse
            cx={(LEFT_X + BOX_W + RIGHT_X) / 2}
            cy={CENTER_Y + BOX_H / 2}
            rx={60}
            ry={30}
            fill={COLORS.success}
            opacity={0.08 + glowIntensity * 0.12}
            filter="url(#impGlow)"
          />
        )}

        {/* Animated dots */}
        {Array.from({ length: DOT_COUNT }).map((_, i) => {
          const dotDelay = delay + 20;
          const cycleDuration = 40; // frames per cycle
          const phase = (frame - dotDelay + i * (cycleDuration / DOT_COUNT)) % cycleDuration;
          const t = Math.max(0, phase / cycleDuration);

          const wireY = i % 2 === 0 ? CENTER_Y + 30 : CENTER_Y + BOX_H - 30;
          const startX = LEFT_X + BOX_W;
          const endX = RIGHT_X;

          if (matched) {
            // Flowing dots from source to load
            const direction = i % 2 === 0 ? 1 : -1;
            const rawX =
              direction === 1
                ? interpolate(t, [0, 1], [startX, endX])
                : interpolate(t, [0, 1], [endX, startX]);

            return (
              <circle
                key={i}
                cx={rawX}
                cy={wireY}
                r={4}
                fill={COLORS.success}
                opacity={frame > dotDelay ? 0.8 : 0}
                filter="url(#impGlow)"
              />
            );
          } else {
            // Scattered dissipating dots
            const midX = (startX + endX) / 2;
            const midY = CENTER_Y + BOX_H / 2;
            const angle = (i / DOT_COUNT) * Math.PI * 2 + (frame - dotDelay) * 0.05;
            const radius = 20 + t * 80;
            const dotOpacity = frame > dotDelay ? interpolate(t, [0, 0.5, 1], [0.8, 0.5, 0]) : 0;

            return (
              <circle
                key={i}
                cx={midX + Math.cos(angle) * radius}
                cy={midY + Math.sin(angle) * radius}
                r={3}
                fill={COLORS.error}
                opacity={dotOpacity}
              />
            );
          }
        })}
      </svg>

      {/* Status label */}
      <div
        style={{
          position: "absolute",
          left: (LEFT_X + BOX_W + RIGHT_X) / 2 - 80,
          top: CONNECTION_Y + 40,
          width: 160,
          textAlign: "center",
          padding: "8px 20px",
          borderRadius: 20,
          background: `${statusColor}15`,
          border: `1px solid ${statusColor}50`,
          fontSize: 15,
          fontWeight: 700,
          color: statusColor,
          fontFamily: "JetBrains Mono, monospace",
          opacity: interpolate(frame, [delay + 25, delay + 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          boxShadow: matched ? `0 0 ${12 + glowIntensity * 8}px ${statusColor}30` : "none",
        }}
      >
        {matched ? "MATCHED" : "MISMATCHED"}
      </div>
    </div>
  );
};
