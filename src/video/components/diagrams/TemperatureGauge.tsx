import { type FC } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type TemperatureGaugeProps = {
  delay?: number;
  showLabels?: boolean;
};

const THERM_WIDTH = 40;
const THERM_HEIGHT = 260;
const BULB_RADIUS = 30;
const GAUGE_SPACING = 260;

type GaugeConfig = {
  label: string;
  model: string;
  temp: number;
  fillColor: string;
  description: string;
};

const GAUGES: GaugeConfig[] = [
  {
    label: "Creative",
    model: "Opus",
    temp: 0.5,
    fillColor: "#F97316", // warm orange
    description: "temp = 0.5",
  },
  {
    label: "Precise",
    model: "Sonnet",
    temp: 0.2,
    fillColor: COLORS.cyan, // cool blue
    description: "temp = 0.2",
  },
];

const ThermometerSVG: FC<{
  fillLevel: number;
  fillColor: string;
  opacity: number;
}> = ({ fillLevel, fillColor, opacity }) => {
  const totalHeight = THERM_HEIGHT + BULB_RADIUS;
  const fillHeight = THERM_HEIGHT * fillLevel;
  const tubeX = 0;
  const tubeWidth = THERM_WIDTH;
  const bulbCenterY = THERM_HEIGHT + BULB_RADIUS / 2;

  return (
    <svg
      width={tubeWidth + 20}
      height={totalHeight + 20}
      viewBox={`-10 -10 ${tubeWidth + 20} ${totalHeight + 20}`}
      style={{ opacity }}
    >
      <defs>
        <clipPath id={`thermClip-${fillColor}`}>
          {/* Tube */}
          <rect x={tubeX + 6} y={0} width={tubeWidth - 12} height={THERM_HEIGHT} rx={10} />
          {/* Bulb */}
          <circle cx={tubeWidth / 2} cy={bulbCenterY} r={BULB_RADIUS - 4} />
        </clipPath>
        <filter id={`thermGlow-${fillColor}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer tube */}
      <rect
        x={tubeX + 4}
        y={-2}
        width={tubeWidth - 8}
        height={THERM_HEIGHT + 4}
        rx={12}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={2}
      />
      {/* Outer bulb */}
      <circle
        cx={tubeWidth / 2}
        cy={bulbCenterY}
        r={BULB_RADIUS - 2}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={2}
      />

      {/* Fill */}
      <g clipPath={`url(#thermClip-${fillColor})`}>
        {/* Background */}
        <rect x={0} y={0} width={tubeWidth} height={totalHeight} fill="rgba(255,255,255,0.04)" />
        {/* Colored fill from bottom */}
        <rect
          x={0}
          y={THERM_HEIGHT - fillHeight}
          width={tubeWidth}
          height={fillHeight + BULB_RADIUS + 20}
          fill={fillColor}
          opacity={0.8}
          filter={`url(#thermGlow-${fillColor})`}
        />
      </g>

      {/* Tick marks */}
      {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
        <line
          key={tick}
          x1={tubeWidth + 2}
          y1={THERM_HEIGHT * (1 - tick)}
          x2={tubeWidth + 10}
          y2={THERM_HEIGHT * (1 - tick)}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
};

export const TemperatureGauge: FC<TemperatureGaugeProps> = ({ delay = 0, showLabels = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: GAUGE_SPACING,
        alignItems: "flex-end",
        position: "relative",
      }}
    >
      {GAUGES.map((gauge, i) => {
        const gaugeDelay = delay + i * 12;
        const entryProgress = spring({
          frame: frame - gaugeDelay,
          fps,
          config: SPRING_CONFIGS.smooth,
        });

        // Animate fill level
        const fillProgress = spring({
          frame: frame - (gaugeDelay + 10),
          fps,
          config: SPRING_CONFIGS.heavy,
        });
        const fillLevel = gauge.temp * fillProgress;

        const labelOpacity = showLabels
          ? interpolate(frame, [gaugeDelay + 20, gaugeDelay + 35], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;

        return (
          <div
            key={gauge.model}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Model name */}
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: gauge.fillColor,
                fontFamily: "Inter, sans-serif",
                opacity: entryProgress,
              }}
            >
              {gauge.model}
            </div>

            {/* Thermometer */}
            <ThermometerSVG
              fillLevel={fillLevel}
              fillColor={gauge.fillColor}
              opacity={entryProgress}
            />

            {/* Temperature number */}
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: gauge.fillColor,
                fontFamily: "JetBrains Mono, monospace",
                opacity: entryProgress,
              }}
            >
              {gauge.description}
            </div>

            {/* Label */}
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.textSecondary,
                fontFamily: "Inter, sans-serif",
                padding: "4px 16px",
                borderRadius: 12,
                background: `${gauge.fillColor}10`,
                border: `1px solid ${gauge.fillColor}30`,
                opacity: labelOpacity,
              }}
            >
              {gauge.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
