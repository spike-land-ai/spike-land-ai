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
import { KineticText } from "../../components/ui/KineticText";
import { PlatformCard } from "../../components/ui/PlatformCard";
import { BrowserFrame } from "../../components/mockups/BrowserFrame";
import { GradientMesh } from "../../components/branding/GradientMesh";

export const Scene02_Platform: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Four platform cards (0-211) */}
      <Sequence from={0} durationInFrames={211}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 60,
          }}
        >
          <div style={{ marginBottom: 30 }}>
            <KineticText
              text="Four Products, One Platform"
              fontSize={56}
              color={COLORS.textPrimary}
              type="reveal"
              delay={5}
            />
          </div>
          <PlatformCard
            icon="⌨️"
            title="Codespace"
            subtitle="Describe → AI builds live"
            color={COLORS.cyan}
            delay={16}
          />
          <PlatformCard
            icon="📝"
            title="Blog"
            subtitle="Syntax + read-aloud"
            color={COLORS.purple}
            delay={26}
          />
          <PlatformCard
            icon="📚"
            title="LearnIT Wiki"
            subtitle="AI-generated knowledge"
            color={COLORS.amber}
            delay={37}
          />
          <PlatformCard
            icon="🔗"
            title="Dynamic Pages"
            subtitle="Every URL → working app"
            color={COLORS.success}
            delay={47}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: Browser frame mockup (211-422) */}
      <Sequence from={211} durationInFrames={211}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 60,
          }}
        >
          <div
            style={{
              opacity: spring({
                frame: frame - 221,
                fps,
                config: SPRING_CONFIGS.smooth,
              }),
              transform: `scale(${interpolate(
                spring({
                  frame: frame - 221,
                  fps,
                  config: SPRING_CONFIGS.smooth,
                }),
                [0, 1],
                [0.95, 1],
              )})`,
              width: 920,
              height: 700,
            }}
          >
            <BrowserFrame url="spike.land" width={920} height={700}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  gap: 30,
                  background: `linear-gradient(135deg, ${COLORS.darkBg}, #1a1a2e)`,
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 700,
                    fontFamily: TYPOGRAPHY.fontFamily.mono,
                    color: COLORS.textPrimary,
                    opacity: interpolate(frame, [222, 237], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  spike<span style={{ color: COLORS.amber }}>.land</span>
                </div>
                <div
                  style={{
                    fontSize: 28,
                    color: COLORS.textSecondary,
                    fontWeight: 500,
                    textAlign: "center",
                    maxWidth: 700,
                    opacity: interpolate(frame, [248, 269], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                >
                  Every URL is an app waiting to be born
                </div>
              </div>
            </BrowserFrame>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Closing statement (422-633) */}
      <Sequence from={422} durationInFrames={211}>
        <AbsoluteFill>
          <GradientMesh
            animationSpeed={0.02}
            opacity={interpolate(frame, [422, 454], [0, 0.8], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })}
          />
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KineticText
              text="Let me show you each one"
              fontSize={64}
              color={COLORS.textPrimary}
              type="scale"
              delay={438}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
