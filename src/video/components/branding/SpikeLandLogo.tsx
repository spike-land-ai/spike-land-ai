import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, SPRING_CONFIGS } from "../../lib/constants";

type SpikeLandLogoProps = {
  size?: number;
  delay?: number;
  showWordmark?: boolean;
  animate?: boolean;
};

/**
 * spike.land bolt icon - recreated from the SVG
 */
export function BoltIcon({ size = 64, color = COLORS.gold }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={COLORS.amber}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill={color} />
    </svg>
  );
}

export function SpikeLandLogo({
  size = 120,
  delay = 0,
  showWordmark = true,
  animate = true,
}: SpikeLandLogoProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryProgress = animate
    ? spring({
        frame: frame - delay,
        fps,
        config: SPRING_CONFIGS.bouncy,
      })
    : 1;

  const wordmarkProgress = animate
    ? spring({
        frame: frame - delay - 15,
        fps,
        config: SPRING_CONFIGS.smooth,
      })
    : 1;

  const iconScale = interpolate(entryProgress, [0, 1], [0, 1]);
  const iconRotation = interpolate(entryProgress, [0, 1], [-45, 0]);
  const iconOpacity = interpolate(entryProgress, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  const wordmarkOpacity = interpolate(wordmarkProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const wordmarkX = interpolate(wordmarkProgress, [0, 1], [20, 0]);

  // Glow pulse
  const glowPulse = animate ? Math.sin((frame - delay) * 0.1) * 0.3 + 0.7 : 1;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: size * 0.2,
      }}
    >
      {/* Bolt icon */}
      <div
        style={{
          opacity: iconOpacity,
          transform: `scale(${iconScale}) rotate(${iconRotation}deg)`,
          filter: `drop-shadow(0 0 ${20 * glowPulse}px ${COLORS.amber}80)`,
        }}
      >
        <BoltIcon size={size} />
      </div>

      {/* Wordmark */}
      {showWordmark && (
        <div
          style={{
            opacity: wordmarkOpacity,
            transform: `translateX(${wordmarkX}px)`,
          }}
        >
          <div
            style={{
              fontSize: size * 0.5,
              fontWeight: 700,
              fontFamily: "Inter, sans-serif",
              color: COLORS.textPrimary,
              letterSpacing: "-0.02em",
            }}
          >
            spike
            <span style={{ color: COLORS.amber }}>.land</span>
          </div>
        </div>
      )}
    </div>
  );
}

type LogoWithTaglineProps = {
  delay?: number;
  tagline?: string;
};

export function LogoWithTagline({
  delay = 0,
  tagline = "AI That Builds. Results That Matter.",
}: LogoWithTaglineProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineProgress = spring({
    frame: frame - delay - 30,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const taglineOpacity = interpolate(taglineProgress, [0, 1], [0, 1], {
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(taglineProgress, [0, 1], [10, 0]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
      }}
    >
      <SpikeLandLogo size={120} delay={delay} />

      <div
        style={{
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
          fontSize: 24,
          color: COLORS.textSecondary,
          fontFamily: "Inter, sans-serif",
          fontWeight: 500,
          letterSpacing: "0.02em",
        }}
      >
        {tagline}
      </div>
    </div>
  );
}
