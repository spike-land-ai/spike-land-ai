import { type FC } from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { COLORS, SPRING_CONFIGS, TYPOGRAPHY } from "../../lib/constants";
import { N404_DURATIONS } from "../../lib/n404-constants";
import { typewriter } from "../../lib/animations";
import { BrowserFrame } from "../../components/mockups/BrowserFrame";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { KineticText } from "../../components/ui/KineticText";

const SONIC_ALARM_CODE = `export function SonicAlarmStudio() {
  const [alarms, setAlarms] = useState([]);
  const [frequency, setFrequency] = useState(440);
  const audioCtx = useRef(new AudioContext());

  const playTone = (freq: number) => {
    const osc = audioCtx.current.createOscillator();
    osc.frequency.value = freq;
    osc.connect(audioCtx.current.destination);
    osc.start();
    setTimeout(() => osc.stop(), 500);
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1>SonicAlarm Studio</h1>
      <FrequencySlider value={frequency}
        onChange={setFrequency} />
      <AlarmList alarms={alarms}
        onPlay={playTone} />
    </div>
  );
}`;

const ORBS = [
  {
    color: COLORS.cyan,
    size: 180,
    freq: 0.8,
    phaseX: 0,
    phaseY: 0.5,
    cx: 15,
    cy: 30,
  },
  {
    color: COLORS.purple,
    size: 140,
    freq: 1.1,
    phaseX: 1.2,
    phaseY: 0,
    cx: 80,
    cy: 60,
  },
  {
    color: "#FF69B4",
    size: 120,
    freq: 0.6,
    phaseX: 2.5,
    phaseY: 1.8,
    cx: 50,
    cy: 80,
  },
];

const SpikeLandLandingMockup: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Badge: "The Future of Creation" — spring fade-in + shimmer
  const badgeProgress = spring({ frame, fps, config: SPRING_CONFIGS.gentle });
  const badgeOpacity = interpolate(badgeProgress, [0, 0.6], [0, 1], {
    extrapolateRight: "clamp",
  });
  const badgeY = interpolate(badgeProgress, [0, 1], [20, 0]);
  const shimmerX = interpolate(frame % 90, [0, 90], [-100, 200]);

  // "Build the" text — fade in at frame 50
  const buildOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const buildY = interpolate(frame, [50, 70], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Impossible." gradient text — scale + opacity at frame 100
  const impossibleOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const impossibleScale = interpolate(frame, [100, 145], [0.85, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gradientPos = (frame % 120) * 3;

  // Cyan glow behind headline
  const glowOpacity = interpolate(frame, [90, 140], [0, 0.7], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtitle
  const subtitleOpacity = interpolate(frame, [155, 185], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleY = interpolate(frame, [155, 185], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Composer box
  const composerScale = spring({
    frame: frame - 210,
    fps,
    config: SPRING_CONFIGS.snappy,
  });
  const composerOpacity = interpolate(composerScale, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const composerPlaceholder =
    frame >= 210 ? typewriter(frame, fps, "Describe what you want to build...", 20, 230) : "";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "linear-gradient(180deg, #0a0a0f 0%, #0d0d1a 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        padding: "40px 30px",
        gap: 24,
      }}
    >
      {/* Floating orbs */}
      {frame >= 50 &&
        ORBS.map((orb, i) => {
          const orbOpacity = interpolate(frame, [50, 80], [0, 0.35], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const xOffset = Math.sin((frame / fps) * orb.freq + orb.phaseX) * 30;
          const yOffset = Math.cos((frame / fps) * orb.freq + orb.phaseY) * 20;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${orb.cx}%`,
                top: `${orb.cy}%`,
                width: orb.size,
                height: orb.size,
                borderRadius: "50%",
                background: orb.color,
                filter: `blur(${orb.size * 0.6}px)`,
                opacity: orbOpacity,
                transform: `translate(${xOffset}px, ${yOffset}px)`,
                pointerEvents: "none" as const,
              }}
            />
          );
        })}

      {/* Badge */}
      <div
        style={{
          opacity: badgeOpacity,
          transform: `translateY(${badgeY}px)`,
          position: "relative",
          overflow: "hidden",
          borderRadius: 20,
          padding: "6px 18px",
          border: `1px solid ${COLORS.darkBorder}`,
          background: "rgba(255,255,255,0.05)",
          fontSize: 14,
          color: COLORS.textSecondary,
          fontFamily: TYPOGRAPHY.fontFamily.sans,
          letterSpacing: 1,
        }}
      >
        The Future of Creation
        {/* Shimmer sweep */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)`,
            transform: `translateX(${shimmerX}%)`,
            pointerEvents: "none" as const,
          }}
        />
      </div>

      {/* Headline area */}
      <div style={{ textAlign: "center", position: "relative" }}>
        {/* Cyan glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 400,
            height: 200,
            borderRadius: "50%",
            background: COLORS.cyan,
            filter: "blur(120px)",
            opacity: glowOpacity,
            transform: "translate(-50%, -50%)",
            pointerEvents: "none" as const,
          }}
        />

        {/* "Build the" */}
        <div
          style={{
            opacity: buildOpacity,
            transform: `translateY(${buildY}px)`,
            fontSize: 52,
            fontWeight: 600,
            color: COLORS.textPrimary,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            lineHeight: 1.2,
          }}
        >
          Build the
        </div>

        {/* "Impossible." with animated gradient */}
        <div
          style={{
            opacity: impossibleOpacity,
            transform: `scale(${impossibleScale})`,
            fontSize: 72,
            fontWeight: 800,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            lineHeight: 1.1,
            background: `linear-gradient(90deg, ${COLORS.cyan}, ${COLORS.purple}, #FF69B4, ${COLORS.cyan})`,
            backgroundSize: "300% 100%",
            backgroundPosition: `${gradientPos}% 0`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Impossible.
        </div>
      </div>

      {/* Subtitle */}
      <div
        style={{
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
          fontSize: 20,
          color: COLORS.textSecondary,
          fontFamily: TYPOGRAPHY.fontFamily.sans,
          textAlign: "center",
          maxWidth: 500,
          lineHeight: 1.5,
        }}
      >
        AI-powered universe where your ideas become reality
      </div>

      {/* Composer box */}
      <div
        style={{
          opacity: composerOpacity,
          transform: `scale(${interpolate(composerScale, [0, 1], [0.9, 1])})`,
          width: "85%",
          maxWidth: 560,
          height: 56,
          borderRadius: 14,
          border: `1px solid ${COLORS.darkBorder}`,
          background: "rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          fontSize: 16,
          color: COLORS.textMuted,
          fontFamily: TYPOGRAPHY.fontFamily.sans,
          boxShadow: `0 0 30px rgba(0,229,255,0.08)`,
        }}
      >
        {composerPlaceholder}
        {/* Blinking cursor */}
        {frame >= 230 && (
          <span
            style={{
              opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0,
              color: COLORS.cyan,
              marginLeft: 1,
            }}
          >
            |
          </span>
        )}
      </div>
    </div>
  );
};

export const Scene01_Hook: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = N404_DURATIONS.hook;

  // Part 1: BrowserFrame with real app (0 → 60%)
  const part1End = Math.round(duration * 0.6);
  // Part 2: Source code reveal (60% → 100%)
  const part2Start = part1End;
  const part2Duration = duration - part2Start;

  // Browser frame entry animation
  const browserScale = spring({
    frame: frame - 10,
    fps,
    config: SPRING_CONFIGS.smooth,
  });

  const browserOpacity = interpolate(browserScale, [0, 0.5], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: BrowserFrame showing spike.land landing (0 → 60%) */}
      <Sequence from={0} durationInFrames={part1End}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px 40px",
          }}
        >
          <div
            style={{
              opacity: browserOpacity,
              transform: `scale(${interpolate(browserScale, [0, 1], [0.95, 1])})`,
              width: 960,
              height: 1500,
            }}
          >
            <BrowserFrame
              url={typewriter(frame, fps, "spike.land", 15, 5)}
              width={960}
              height={1500}
            >
              <SpikeLandLandingMockup />
            </BrowserFrame>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Source code reveal (60% → 100%) */}
      <Sequence from={part2Start} durationInFrames={part2Duration}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 50px",
            gap: 30,
          }}
        >
          <KineticText
            text="The source code"
            fontSize={44}
            color={COLORS.textPrimary}
            type="reveal"
            delay={part2Start + 5}
          />

          <div style={{ width: 950 }}>
            <CodeBlock
              code={SONIC_ALARM_CODE}
              language="tsx"
              borderColor={COLORS.cyan}
              delay={part2Start + 15}
              typingSpeed={40}
            />
          </div>

          <div
            style={{
              fontSize: 24,
              color: COLORS.textMuted,
              fontWeight: 500,
              textAlign: "center",
              opacity: interpolate(
                frame,
                [part2Start + part2Duration * 0.6, part2Start + part2Duration * 0.8],
                [0, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
            }}
          >
            AI-generated React &bull; Live on Cloudflare Workers
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
