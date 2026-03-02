import { type FC } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { COLORS, TYPOGRAPHY } from "../../lib/constants";
import { SpikeLandLogo } from "../../components/branding/SpikeLandLogo";
import { GradientMesh } from "../../components/branding/GradientMesh";
import { KineticText } from "../../components/ui/KineticText";
import { GlassmorphismCard } from "../../components/ui/GlassmorphismCard";
import { stagger } from "../../lib/animations";

const CTA_ITEMS = [
  { label: "Try it", sub: "spike.land", color: COLORS.cyan },
  { label: "Star it", sub: "GitHub", color: COLORS.purple },
  { label: "Fork it", sub: "Open Source", color: COLORS.amber },
];

export const Scene10_EndCard: FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.darkBg,
        fontFamily: TYPOGRAPHY.fontFamily.sans,
      }}
    >
      {/* Part 1: Logo with gradient mesh (0-216) */}
      <Sequence from={0} durationInFrames={216}>
        <AbsoluteFill>
          <GradientMesh animationSpeed={0.02} opacity={0.8} />
          <AbsoluteFill
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SpikeLandLogo size={200} delay={7} />
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Part 2: 3 CTA cards stacked vertically (216-432) */}
      <Sequence from={216} durationInFrames={216}>
        <AbsoluteFill>
          <GradientMesh animationSpeed={0.015} opacity={0.5} />
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 40,
            }}
          >
            {CTA_ITEMS.map((cta, i) => (
              <GlassmorphismCard
                key={cta.label}
                width={700}
                height={140}
                delay={231 + stagger(i, 9)}
                color={cta.color}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: TYPOGRAPHY.fontSize["4xl"],
                      fontWeight: 700,
                      color: cta.color,
                    }}
                  >
                    {cta.label}
                  </div>
                  <div
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.xl,
                      color: COLORS.textSecondary,
                    }}
                  >
                    {cta.sub}
                  </div>
                </div>
              </GlassmorphismCard>
            ))}
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>

      {/* Part 3: Attribution + closing tagline (432-648) */}
      <Sequence from={432} durationInFrames={216}>
        <AbsoluteFill>
          <GradientMesh animationSpeed={0.01} opacity={0.4} />
          <AbsoluteFill
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 50,
            }}
          >
            <SpikeLandLogo size={100} delay={0} animate={false} />
            <KineticText
              text="Built with passion"
              fontSize={36}
              color={COLORS.textSecondary}
              type="reveal"
              delay={446}
            />
            <KineticText
              text="and the Vibeathon 2026"
              fontSize={36}
              color={COLORS.textSecondary}
              type="reveal"
              delay={475}
            />
            <div
              style={{
                marginTop: 30,
                fontSize: TYPOGRAPHY.fontSize.xl,
                fontStyle: "italic",
                color: COLORS.textMuted,
                textAlign: "center",
                opacity: interpolate(frame, [540, 562], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Every URL is an app waiting to be born
            </div>
          </AbsoluteFill>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
