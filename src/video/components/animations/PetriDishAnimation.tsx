import { Fragment } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS, VERITASIUM_COLORS } from "../../lib/constants";
import { pulse } from "../../lib/animations";

type Organism = {
  label: string;
  status: "candidate" | "active" | "deprecated";
  confidence: number; // 0-1
};

type PetriDishAnimationProps = {
  organisms: Organism[];
  delay?: number;
};

const STATUS_COLORS: Record<string, string> = {
  candidate: VERITASIUM_COLORS.candidate,
  active: VERITASIUM_COLORS.active,
  deprecated: VERITASIUM_COLORS.deprecated,
};

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function PetriDishAnimation({ organisms, delay = 0 }: PetriDishAnimationProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dishRadius = 350;
  const cx = 960;
  const cy = 500;

  return (
    <AbsoluteFill
      style={{
        background: COLORS.darkBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={1920} height={1080} viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id="dish-bg">
            <stop offset="0%" stopColor={COLORS.darkCard} stopOpacity={0.6} />
            <stop offset="100%" stopColor={COLORS.darkBg} stopOpacity={0.9} />
          </radialGradient>
          {/* Glow filter for active organisms */}
          <filter id="organism-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dish border */}
        <circle
          cx={cx}
          cy={cy}
          r={dishRadius}
          fill="url(#dish-bg)"
          stroke={COLORS.darkBorder}
          strokeWidth={3}
        />

        {/* Dish inner ring */}
        <circle
          cx={cx}
          cy={cy}
          r={dishRadius - 20}
          fill="none"
          stroke={COLORS.darkBorder}
          strokeWidth={1}
          strokeDasharray="8 4"
          opacity={0.4}
        />

        {/* Organisms */}
        {organisms.map((org, i) => {
          const angle = (i / organisms.length) * Math.PI * 2 + seededRandom(i * 3) * 0.5;
          const dist = 80 + seededRandom(i * 7) * (dishRadius - 140);
          const ox = cx + Math.cos(angle) * dist;
          const oy = cy + Math.sin(angle) * dist;
          const color = STATUS_COLORS[org.status];

          const entrance = spring({
            frame: frame - delay - i * 5,
            fps,
            config: SPRING_CONFIGS.bouncy,
          });

          // Radius based on confidence
          const baseRadius = interpolate(org.confidence, [0, 1], [8, 35], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const radius = baseRadius * entrance;

          // Active organisms pulse
          const isHealthy = org.status === "active" && org.confidence > 0.6;
          const pulseAmount = isHealthy ? pulse(frame, fps, 1.5) : 0;
          const glowRadius = radius + pulseAmount * 8;

          // Deprecated organisms fade
          const fadeOpacity =
            org.status === "deprecated"
              ? interpolate(org.confidence, [0, 0.3], [0.15, 0.6], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;

          return (
            <Fragment key={`org-${i}`}>
              {/* Glow ring for healthy organisms */}
              {isHealthy && (
                <circle
                  cx={ox}
                  cy={oy}
                  r={glowRadius}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  opacity={0.3 * pulseAmount * entrance}
                />
              )}

              {/* Organism body */}
              <circle
                cx={ox}
                cy={oy}
                r={radius}
                fill={`${color}40`}
                stroke={color}
                strokeWidth={2}
                opacity={fadeOpacity * entrance}
                filter={isHealthy ? "url(#organism-glow)" : undefined}
              />

              {/* Label */}
              {radius > 15 && (
                <text
                  x={ox}
                  y={oy + 4}
                  textAnchor="middle"
                  fill={COLORS.textPrimary}
                  fontSize={Math.min(12, radius * 0.6)}
                  fontFamily="JetBrains Mono, monospace"
                  opacity={fadeOpacity * entrance}
                >
                  {org.label}
                </text>
              )}
            </Fragment>
          );
        })}

        {/* Title */}
        <text
          x={cx}
          y={cy + dishRadius + 60}
          textAnchor="middle"
          fill={COLORS.textSecondary}
          fontSize={16}
          fontFamily="Inter, sans-serif"
        >
          Learning Notes — Petri Dish
        </text>
      </svg>
    </AbsoluteFill>
  );
}
